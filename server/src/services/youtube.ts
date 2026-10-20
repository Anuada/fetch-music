import { Innertube, Platform, YTMusic, YTNodes } from 'youtubei.js';
import type {
  AlbumDetail,
  ArtistDetail,
  BrowseCategoryGroup,
  Card,
  CategoryDetail,
  MediaItem,
  PlaylistDetail,
  PodcastDetail,
  SearchFilter,
  SearchResult,
  Shelf,
  SuggestionResult,
  Track,
  TrackDetail,
} from '../types.js';
import {
  asCard,
  asTrack,
  buildShelf,
  cardKindOf,
  cleanText,
  collectSearchItems,
  descriptionText,
  mediaFrom,
  shelfTitle,
  text,
  thumbnailOf,
} from '../lib/normalize.js';

type AnyRecord = Record<string, any>;

Platform.shim.eval = async (data) => new Function(data.output)();

/**
 * Raw YouTube Music search params for filters that youtubei.js does not encode itself.
 * Format: "EgWKAQ" + filter code + "AWoMEA4QChADEAQQCRAF" (same scheme used by ytmusicapi).
 */
const RAW_SEARCH_PARAMS: Partial<Record<SearchFilter, string>> = {
  podcast: 'EgWKAQJQAWoMEA4QChADEAQQCRAF',
  episode: 'EgWKAQJIAWoMEA4QChADEAQQCRAF',
};

const CARD_FILTERS = new Set<SearchFilter>(['album', 'artist', 'playlist', 'podcast']);

let clientPromise: Promise<Innertube> | null = null;

function getClient(): Promise<Innertube> {
  if (!clientPromise) {
    clientPromise = Innertube.create({
      lang: 'en',
      location: 'US',
      retrieve_player: true,
    }).catch((error) => {
      clientPromise = null;
      throw error;
    });
  }
  return clientPromise;
}

export function warmupYoutube(): void {
  void getClient().catch(() => undefined);
}

export async function resolveAudioStream(
  videoId: string,
): Promise<{ url: string; expires: number }> {
  const yt = await getClient();
  let format;
  try {
    format = await yt.getStreamingData(videoId, {
      type: 'audio',
      quality: 'best',
      format: 'mp4',
      client: 'VISIONOS',
    });
  } catch {
    format = await yt.getStreamingData(videoId, {
      type: 'audio',
      quality: 'best',
      format: 'mp4',
      client: 'YTMUSIC',
    });
  }
  if (!format.url) throw new Error('YouTube did not return a playable audio URL');
  return { url: format.url, expires: expiryOf(format.url) };
}

function expiryOf(url: string): number {
  let expires = Date.now() + 25 * 60_000;
  try {
    const expire = Number(new URL(url).searchParams.get('expire'));
    if (Number.isFinite(expire) && expire > 0) {
      expires = Math.max(Date.now() + 60_000, expire * 1000 - 60_000);
    }
  } catch {
    // Keep the conservative fallback.
  }
  return expires;
}

const VIDEO_QUALITIES = ['1080p', '720p', '480p', '360p'] as const;
export type VideoQuality = (typeof VIDEO_QUALITIES)[number];

/**
 * Resolves a video-only H.264 stream (the browser keeps audio on the existing audio element
 * and syncs the picture to it). Falls back to lower qualities, then to the muxed 360p format.
 */
export async function resolveVideoStream(
  videoId: string,
  quality: VideoQuality,
): Promise<{ url: string; expires: number; quality: string }> {
  const yt = await getClient();
  const start = Math.max(0, VIDEO_QUALITIES.indexOf(quality));
  for (const candidate of VIDEO_QUALITIES.slice(start)) {
    for (const client of ['YTMUSIC', 'MWEB'] as const) {
      try {
        const format = await yt.getStreamingData(videoId, {
          type: 'video',
          quality: candidate,
          format: 'mp4',
          codec: 'avc',
          client,
        });
        if (format.url) {
          return { url: format.url, expires: expiryOf(format.url), quality: format.quality_label ?? candidate };
        }
      } catch {
        // Try the next client / quality.
      }
    }
  }
  for (const client of ['YTMUSIC', 'ANDROID', 'MWEB'] as const) {
    try {
      const format = await yt.getStreamingData(videoId, {
        type: 'video+audio',
        quality: 'best',
        format: 'mp4',
        client,
      });
      if (format.url) {
        return { url: format.url, expires: expiryOf(format.url), quality: format.quality_label ?? '360p' };
      }
    } catch {
      // Try the next client.
    }
  }
  throw new Error('YouTube did not return a playable video URL');
}

const cache = new Map<string, { expires: number; value: unknown }>();

function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return Promise.resolve(hit.value as T);
  return load().then((value) => {
    cache.set(key, { expires: Date.now() + ttlMs, value });
    if (cache.size > 250) {
      const first = cache.keys().next().value;
      if (first) cache.delete(first);
    }
    return value;
  });
}

/** Google image URLs carry their size in the path; ask for a crisper version. */
function upscale(url: string, size = 544): string {
  return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
}

async function runSearch(query: string, filter: SearchFilter): Promise<AnyRecord> {
  const yt = await getClient();
  const raw = RAW_SEARCH_PARAMS[filter];
  if (raw) {
    const endpoint = new YTNodes.NavigationEndpoint({ searchEndpoint: { query, params: raw } });
    const response = await endpoint.call(yt.actions, { client: 'YTMUSIC' });
    return new YTMusic.Search(response as any, yt.actions, true) as unknown as AnyRecord;
  }
  if (filter === 'all') return (await yt.music.search(query)) as AnyRecord;
  return (await yt.music.search(query, { type: filter as any })) as AnyRecord;
}

/** Converts the "Top result" card shelf into a playable track or navigable card. */
function topResultOf(response: AnyRecord): MediaItem | null {
  const shelf = (response.contents ?? []).find((node: AnyRecord) => node?.type === 'MusicCardShelf');
  if (!shelf) return null;
  const title = text(shelf.title);
  const subtitle = text(shelf.subtitle);
  const thumbnail = upscale(thumbnailOf(shelf));
  const payload = shelf.on_tap?.payload ?? shelf.title?.endpoint?.payload ?? {};
  if (!title) return null;
  if (typeof payload.videoId === 'string') {
    const parts = subtitle.split(' • ').map((part: string) => part.trim());
    const label = (parts[0] ?? '').toLowerCase();
    return {
      kind: 'track',
      id: payload.videoId,
      title,
      artist: parts[1] || 'Unknown artist',
      duration: 0,
      thumbnail,
      type: label === 'video' ? 'video' : label === 'episode' ? 'episode' : 'song',
    };
  }
  const kind = cardKindOf(shelf);
  if (!kind || typeof payload.browseId !== 'string') return null;
  return { kind, id: payload.browseId, title, subtitle, thumbnail };
}

export async function searchMusic(query: string, filter: SearchFilter): Promise<SearchResult> {
  return cached(`search:${filter}:${query.toLowerCase()}`, 5 * 60_000, async () => {
    const response = await runSearch(query, filter);
    const items = collectSearchItems(response);
    const tracks: Track[] = [];
    const cards: Card[] = [];
    const seen = new Set<string>();
    for (const item of items) {
      if (filter === 'all') {
        const media = mediaFrom(item);
        if (!media || seen.has(`${media.kind}:${media.id}`)) continue;
        seen.add(`${media.kind}:${media.id}`);
        if (media.kind === 'track') tracks.push(media);
        else cards.push(media);
      } else if (CARD_FILTERS.has(filter)) {
        const card = asCard(item);
        if (card) cards.push(card);
      } else {
        const track = asTrack(item);
        if (track) tracks.push(track);
      }
    }
    const result: SearchResult = { query, filter, tracks, cards };
    if (filter === 'all') result.top = topResultOf(response) ?? cards[0] ?? tracks[0] ?? null;
    return result;
  });
}

export async function getSuggestions(query: string): Promise<SuggestionResult> {
  return cached(`suggestions:${query.toLowerCase()}`, 10 * 60_000, async () => {
    const yt = await getClient();
    try {
      const sections = (await yt.music.getSearchSuggestions(query)) as AnyRecord[];
      const suggestions: string[] = [];
      const items: MediaItem[] = [];
      for (const section of sections) {
        for (const item of section.contents ?? []) {
          if (item?.type === 'SearchSuggestion') {
            const suggestion = text(item?.suggestion);
            if (suggestion && !suggestions.includes(suggestion)) suggestions.push(suggestion);
            continue;
          }
          const media = mediaFrom(item);
          if (media) items.push(media);
        }
      }
      return { suggestions: suggestions.slice(0, 8), items: items.slice(0, 5) };
    } catch {
      const fallback = await yt.getSearchSuggestions(query);
      return { suggestions: fallback.slice(0, 8), items: [] };
    }
  });
}

async function browseParsed(browseId: string, params?: string): Promise<AnyRecord> {
  const yt = await getClient();
  const endpoint = new YTNodes.NavigationEndpoint({
    browseEndpoint: params ? { browseId, params } : { browseId },
  });
  return (await endpoint.call(yt.actions, { client: 'YTMUSIC', parse: true })) as AnyRecord;
}

export async function getMoodsAndGenres(): Promise<BrowseCategoryGroup[]> {
  return cached('moods-and-genres', 6 * 60 * 60_000, async () => {
    const response = await browseParsed('FEmusic_moods_and_genres');
    const sectionList = response.contents_memo?.getType(YTNodes.SectionList)?.[0];
    const groups: BrowseCategoryGroup[] = [];
    for (const section of sectionList?.contents ?? []) {
      const title = text(section?.header?.title) || 'Browse';
      const items = [];
      for (const button of section?.items ?? section?.contents ?? []) {
        const params = button?.endpoint?.payload?.params;
        const label = text(button?.button_text);
        if (typeof params === 'string' && label) items.push({ id: params, title: label, group: title });
      }
      if (items.length > 0) groups.push({ title, items });
    }
    return groups;
  });
}

export async function getMoodCategory(id: string): Promise<CategoryDetail> {
  return cached(`mood:${id}`, 60 * 60_000, async () => {
    const response = await browseParsed('FEmusic_moods_and_genres_category', id);
    const sectionList = response.contents_memo?.getType(YTNodes.SectionList)?.[0];
    const shelves: Shelf[] = [];
    for (const section of sectionList?.contents ?? []) {
      const contents = section?.contents ?? section?.items ?? [];
      const shelf = buildShelf({ ...section, contents });
      if (shelf) {
        shelf.title = shelf.title || shelfTitle(section) || 'Featured';
        shelves.push(shelf);
      }
    }
    const title =
      text(response.header?.title) ||
      (await getMoodsAndGenres().catch(() => []))
        .flatMap((group) => group.items)
        .find((item) => item.id === id)?.title ||
      'Browse';
    return { id, title, shelves };
  });
}

/** Finds the first value stored under `key` anywhere inside a raw InnerTube response. */
function findDeep(node: unknown, key: string): AnyRecord | undefined {
  if (!node || typeof node !== 'object') return undefined;
  const record = node as AnyRecord;
  if (record[key]) return record[key];
  for (const value of Object.values(record)) {
    const found = findDeep(value, key);
    if (found) return found;
  }
  return undefined;
}

function findAllDeep(node: unknown, key: string, output: AnyRecord[] = []): AnyRecord[] {
  if (!node || typeof node !== 'object') return output;
  const record = node as AnyRecord;
  if (record[key]) output.push(record[key]);
  for (const [name, value] of Object.entries(record)) {
    if (name !== key) findAllDeep(value, key, output);
  }
  return output;
}

function rawText(value: AnyRecord | undefined): string {
  if (!value) return '';
  if (typeof value.simpleText === 'string') return value.simpleText;
  return (value.runs ?? []).map((run: AnyRecord) => String(run.text ?? '')).join('');
}

function rawThumb(value: AnyRecord | undefined): string {
  const list: AnyRecord[] = value?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? value?.thumbnails ?? [];
  return [...list].sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0))[0]?.url ?? '';
}

/** Parses durations like "2 hr 45 min", "58 min" or "1:02:03". */
function humanDuration(value: string): number {
  const clock = value.match(/\b(\d{1,2}:)?\d{1,2}:\d{2}\b/)?.[0];
  if (clock) return clock.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  const hours = Number(value.match(/(\d+)\s*(hr|hour)/i)?.[1] ?? 0);
  const minutes = Number(value.match(/(\d+)\s*min/i)?.[1] ?? 0);
  const seconds = Number(value.match(/(\d+)\s*sec/i)?.[1] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function getPodcast(id: string): Promise<PodcastDetail> {
  return cached(`podcast:${id}`, 15 * 60_000, async () => {
    const yt = await getClient();
    const response = await yt.actions.execute('/browse', { browseId: id, client: 'YTMUSIC' });
    const data = response.data as AnyRecord;
    const header = findDeep(data, 'musicResponsiveHeaderRenderer') ?? {};
    const title = rawText(header.title) || 'Podcast';
    const author = rawText(header.straplineTextOne) || 'Podcast';
    const thumbnail = rawThumb(header.thumbnail);
    const description = cleanText(
      rawText(findDeep(header.description, 'musicDescriptionShelfRenderer')?.description) ||
        rawText(header.description),
    );
    const episodes: Track[] = [];
    for (const item of findAllDeep(data, 'musicMultiRowListItemRenderer')) {
      const videoId = item.onTap?.watchEndpoint?.videoId;
      const episodeTitle = rawText(item.title);
      if (typeof videoId !== 'string' || !episodeTitle) continue;
      const subtitle = rawText(item.subtitle);
      const progress = item.playbackProgress?.musicPlaybackProgressRenderer;
      const duration = humanDuration(rawText(progress?.durationText) || subtitle);
      episodes.push({
        kind: 'track',
        id: videoId,
        title: episodeTitle,
        artist: title,
        album: subtitle.split(' • ')[0]?.trim() || undefined,
        duration,
        thumbnail: rawThumb(item.thumbnail) || thumbnail,
        type: 'episode',
      });
    }
    return { kind: 'podcast', id, title, author, description, thumbnail, episodes };
  });
}

export async function getHome(): Promise<Shelf[]> {
  return cached('home', 20 * 60_000, async () => {
    const yt = await getClient();
    const home = (await yt.music.getHomeFeed()) as AnyRecord;
    const shelves: Shelf[] = [];
    for (const section of home.sections ?? []) {
      const shelf = buildShelf(section);
      if (shelf && shelf.items.length > 0) {
        if (!shelf.title) shelf.title = 'Recommended for you';
        shelves.push(shelf);
      }
      if (shelves.length >= 10) break;
    }
    return shelves;
  });
}

export async function getAlbum(id: string): Promise<AlbumDetail> {
  return cached(`album:${id}`, 30 * 60_000, async () => {
    const yt = await getClient();
    const album = (await yt.music.getAlbum(id)) as AnyRecord;
    const header = album.header ?? {};
    const tracks = (album.contents ?? [])
      .map((item: AnyRecord) => asTrack(item))
      .filter((track: Track | null): track is Track => Boolean(track));
    const title = text(header.title) || text(album.title) || 'Album';
    const artist = text(header.strapline_text_one) || tracks[0]?.artist || 'Unknown artist';
    const year = text(header.subtitle).match(/\b(19|20)\d{2}\b/)?.[0];
    return {
      kind: 'album',
      id,
      title,
      artist,
      year,
      description: cleanText(descriptionText(header.description)),
      thumbnail: thumbnailOf(header) || tracks[0]?.thumbnail || '',
      trackCount: tracks.length,
      durationText: text(header.second_subtitle),
      tracks,
    };
  });
}

export async function getArtist(id: string): Promise<ArtistDetail> {
  return cached(`artist:${id}`, 30 * 60_000, async () => {
    const yt = await getClient();
    const artist = (await yt.music.getArtist(id)) as AnyRecord;
    const header = artist.header ?? {};
    const sections: Shelf[] = [];
    let tracks: Track[] = [];
    for (const section of artist.sections ?? []) {
      const shelf = buildShelf(section);
      if (!shelf) continue;
      if (tracks.length === 0 && shelf.items.every((item) => item.kind === 'track')) {
        tracks = shelf.items as Track[];
      }
      sections.push(shelf);
    }
    if (tracks.length === 0) {
      tracks = artist.sections
        ?.flatMap((section: AnyRecord) => section.contents ?? [])
        .map((item: AnyRecord) => asTrack(item))
        .filter((track: Track | null): track is Track => Boolean(track))
        .slice(0, 20) ?? [];
    }
    const subscriberText =
      text(header.subscription_button?.subscribe_accessibility_label) ||
      text(header.subtitle) ||
      '';
    return {
      kind: 'artist',
      id,
      title: text(header.title) || 'Artist',
      description: cleanText(descriptionText(header.description)),
      thumbnail: thumbnailOf(header) || thumbnailOf(artist),
      subscriberText,
      tracks,
      sections,
    };
  });
}

export async function getPlaylist(id: string): Promise<PlaylistDetail> {
  return cached(`playlist:${id}`, 15 * 60_000, async () => {
    const yt = await getClient();
    const playlist = (await yt.music.getPlaylist(id)) as AnyRecord;
    const header = playlist.header ?? {};
    const tracks = (playlist.items ?? [])
      .map((item: AnyRecord) => asTrack(item))
      .filter((track: Track | null): track is Track => Boolean(track));
    const author = text(header.strapline_text_one).trim();
    return {
      kind: 'playlist',
      id,
      title: text(header.title) || 'Playlist',
      author: !author || author === 'N/A' ? 'YouTube Music' : author,
      description: cleanText(descriptionText(header.description)),
      thumbnail: thumbnailOf(header) || tracks[0]?.thumbnail || '',
      trackCountText: text(header.second_subtitle),
      tracks,
    };
  });
}

export async function getTrackDetail(videoId: string): Promise<TrackDetail> {
  return cached(`track:${videoId}`, 10 * 60_000, async () => {
    const yt = await getClient();
    const info = (await yt.music.getInfo(videoId)) as AnyRecord;
    const basic = info.basic_info ?? {};
    const track: Track = {
      kind: 'track',
      id: videoId,
      title: text(basic.title) || 'Unknown track',
      artist: text(basic.author) || 'Unknown artist',
      duration: Math.max(0, Math.round(Number(basic.duration) || 0)),
      thumbnail: thumbnailOf(basic) || '',
      type: basic.is_live ? 'video' : 'song',
    };

    const [relatedResult, upNextResult, lyricsResult] = await Promise.allSettled([
      yt.music.getRelated(videoId),
      yt.music.getUpNext(videoId),
      yt.music.getLyrics(videoId),
    ]);

    const related: Shelf[] = [];
    if (relatedResult.status === 'fulfilled') {
      const relatedResponse = relatedResult.value as AnyRecord;
      for (const section of relatedResponse.contents ?? relatedResponse.sections ?? []) {
        const shelf = buildShelf(section);
        if (shelf && shelf.items.length > 0) {
          if (!shelf.title) shelf.title = 'You might also like';
          related.push(shelf);
        }
      }
    }

    const upNext: Track[] = [];
    if (upNextResult.status === 'fulfilled') {
      for (const item of (upNextResult.value as AnyRecord).contents ?? []) {
        if (item.video_id === videoId) continue;
        const next = asTrack(item);
        if (next) upNext.push(next);
        if (upNext.length >= 30) break;
      }
    }

    const lyrics =
      lyricsResult.status === 'fulfilled'
        ? cleanText(descriptionText((lyricsResult.value as AnyRecord).description))
        : '';

    return { track, related, upNext, lyrics: lyrics || null };
  });
}

export async function findTrack(videoId: string): Promise<Track> {
  const detail = await getTrackDetail(videoId);
  return detail.track;
}
