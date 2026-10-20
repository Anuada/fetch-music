import { Innertube, Platform } from 'youtubei.js';
import type {
  AlbumDetail,
  ArtistDetail,
  Card,
  PlaylistDetail,
  SearchFilter,
  SearchResult,
  Shelf,
  Track,
  TrackDetail,
} from '../types.js';
import {
  asCard,
  asTrack,
  buildShelf,
  cleanText,
  collectSearchItems,
  descriptionText,
  text,
  thumbnailOf,
} from '../lib/normalize.js';

type AnyRecord = Record<string, any>;

Platform.shim.eval = async (data) => new Function(data.output)();

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

  let expires = Date.now() + 25 * 60_000;
  try {
    const expire = Number(new URL(format.url).searchParams.get('expire'));
    if (Number.isFinite(expire) && expire > 0) {
      expires = Math.max(Date.now() + 60_000, expire * 1000 - 60_000);
    }
  } catch {
    // Keep the conservative fallback.
  }

  return { url: format.url, expires };
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

export async function searchMusic(query: string, filter: SearchFilter): Promise<SearchResult> {
  return cached(`search:${filter}:${query.toLowerCase()}`, 5 * 60_000, async () => {
    const yt = await getClient();
    const response = (await yt.music.search(query, { type: filter as any })) as AnyRecord;
    const items = collectSearchItems(response);
    const tracks: Track[] = [];
    const cards: Card[] = [];
    for (const item of items) {
      if (filter === 'album' || filter === 'artist' || filter === 'playlist') {
        const card = asCard(item);
        if (card) cards.push(card);
      } else {
        const track = asTrack(item);
        if (track) tracks.push(track);
      }
    }
    return { query, filter, tracks, cards };
  });
}

export async function getSuggestions(query: string): Promise<string[]> {
  return cached(`suggestions:${query.toLowerCase()}`, 10 * 60_000, async () => {
    const yt = await getClient();
    try {
      const sections = (await yt.music.getSearchSuggestions(query)) as AnyRecord[];
      const suggestions: string[] = [];
      for (const section of sections) {
        for (const item of section.contents ?? []) {
          const suggestion = text(item?.suggestion);
          if (suggestion && !suggestions.includes(suggestion)) suggestions.push(suggestion);
        }
      }
      return suggestions.slice(0, 10);
    } catch {
      const fallback = await yt.getSearchSuggestions(query);
      return fallback.slice(0, 10);
    }
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
