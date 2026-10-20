import type { Card, CardKind, MediaItem, Shelf, Track } from '../types.js';

type AnyRecord = Record<string, any>;

export function text(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  const item = value as AnyRecord;
  if (typeof item.text === 'string') return item.text;
  if (Array.isArray(item.runs)) {
    return item.runs.map((run: AnyRecord) => String(run.text ?? '')).join('');
  }
  const stringified = String(value);
  return stringified === '[object Object]' ? '' : stringified;
}

export function descriptionText(value: unknown): string {
  if (!value) return '';
  const item = value as AnyRecord;
  if (item.type === 'MusicDescriptionShelf') return text(item.description);
  return text(value);
}

export function thumbnailOf(value: unknown): string {
  const item = value as AnyRecord;
  const source = item?.thumbnail;
  if (!source) return '';
  if (Array.isArray(source)) return largestThumbnail(source);
  if (Array.isArray(source.contents)) return largestThumbnail(source.contents);
  if (typeof source.url === 'string') return source.url;
  return '';
}

function largestThumbnail(thumbnails: AnyRecord[]): string {
  const sorted = [...thumbnails]
    .filter((thumb) => typeof thumb?.url === 'string')
    .sort((a, b) => Number(b.width ?? 0) - Number(a.width ?? 0));
  return sorted[0]?.url ?? '';
}

export function parseDurationToSeconds(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = text(value).trim();
  if (!raw) return 0;
  const parts = raw.split(':').map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return 0;
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function durationOf(item: AnyRecord): number {
  const duration = item?.duration;
  if (typeof duration?.seconds === 'number') return Math.max(0, Math.round(duration.seconds));
  return parseDurationToSeconds(duration ?? item?.length_text ?? item?.length);
}

export function artistOf(item: AnyRecord): string {
  const list = item?.artists ?? item?.authors;
  if (Array.isArray(list) && list.length > 0) {
    const names = list.map((artist) => text(artist?.name ?? artist)).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  const author = item?.author;
  if (author) {
    const name = text(author?.name ?? author);
    if (name) return name;
  }
  const subtitle = text(item?.subtitle ?? item?.flex_columns?.[1]?.title);
  const first = subtitle.split(' • ')[0]?.trim();
  return first || 'Unknown artist';
}

export function albumOf(item: AnyRecord): string | undefined {
  const album = text(item?.album?.name ?? item?.album);
  return album || undefined;
}

function itemKind(item: AnyRecord): Track['type'] {
  const type = String(item?.item_type ?? item?.type ?? '');
  const videoType = String(
    item?.endpoint?.payload?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig?.musicVideoType ??
      item?.overlay?.content?.endpoint?.payload?.watchEndpointMusicSupportedConfigs?.watchEndpointMusicConfig
        ?.musicVideoType ??
      '',
  );
  if (type === 'non_music_track' || type === 'podcast_episode' || videoType.includes('PODCAST_EPISODE')) {
    return 'episode';
  }
  return type === 'video' || type === 'musicVideo' ? 'video' : 'song';
}

/** Episode rows look like "Feb 6, 2025 • Show name"; the show is the last segment. */
function episodeShowOf(item: AnyRecord): string {
  const subtitle = text(item?.subtitle ?? item?.flex_columns?.[1]?.title);
  const parts = subtitle.split(' • ').map((part) => part.trim()).filter(Boolean);
  return parts.at(-1) || artistOf(item);
}

export function idOf(item: AnyRecord): string {
  const direct = typeof item?.id === 'string' ? item.id : '';
  if (direct && !/^(VL|MPRE|UC|RD)/.test(direct)) return direct;
  const videoId =
    item?.video_id ??
    item?.endpoint?.payload?.videoId ??
    item?.id ??
    item?.on_tap?.payload?.videoId;
  return typeof videoId === 'string' ? videoId : '';
}

export function asTrack(item: AnyRecord): Track | null {
  const id = idOf(item);
  const title = text(item?.title);
  if (!id || !title) return null;
  const type = itemKind(item);
  return {
    kind: 'track',
    id,
    title,
    artist: type === 'episode' ? episodeShowOf(item) : artistOf(item),
    album: albumOf(item),
    duration: durationOf(item),
    thumbnail: thumbnailOf(item),
    type,
  };
}

function pageTypeOf(item: AnyRecord): string {
  const payload = item?.endpoint?.payload ?? item?.on_tap?.payload ?? item?.title?.endpoint?.payload;
  return String(
    payload?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType ?? '',
  );
}

export function cardKindOf(item: AnyRecord): CardKind | null {
  const value = String(item?.item_type ?? item?.type ?? '').toLowerCase();
  if (value === 'album') return 'album';
  if (value === 'artist') return 'artist';
  if (value === 'playlist') return 'playlist';
  if (value === 'podcast_show' || value === 'podcast') return 'podcast';
  const pageType = pageTypeOf(item);
  if (pageType.includes('PODCAST_SHOW')) return 'podcast';
  if (pageType === 'MUSIC_PAGE_TYPE_ARTIST') return 'artist';
  if (pageType === 'MUSIC_PAGE_TYPE_ALBUM') return 'album';
  if (pageType === 'MUSIC_PAGE_TYPE_PLAYLIST') return 'playlist';
  const subtitle = text(
    item?.subtitle ?? item?.flex_columns?.[1]?.title ?? item?.flex_columns?.[0]?.title,
  ).toLowerCase();
  if (!subtitle) return null;
  if (subtitle.startsWith('album')) return 'album';
  if (subtitle.startsWith('playlist')) return 'playlist';
  if (subtitle.startsWith('podcast')) return 'podcast';
  if (subtitle.includes('subscriber') || subtitle.includes('artist')) return 'artist';
  return null;
}

export function asCard(item: AnyRecord): Card | null {
  const kind = cardKindOf(item);
  const id = idOf(item);
  const title = text(
    item?.title ?? item?.name ?? item?.authors?.[0]?.name ?? item?.flex_columns?.[0]?.title,
  );
  if (!kind || !id || !title) return null;
  const subtitle = text(
    item?.subtitle ?? item?.flex_columns?.[1]?.title ?? item?.flex_columns?.[0]?.title,
  );
  const countText = text(item?.item_count ?? item?.song_count ?? '');
  const itemCount = Number.parseInt(countText.replace(/[^0-9]/g, ''), 10);
  const year = text(item?.year) || subtitle.match(/\b(19|20)\d{2}\b/)?.[0];
  const card: Card = {
    kind,
    id,
    title,
    subtitle: subtitle || kind,
    thumbnail: thumbnailOf(item),
  };
  if (year) card.year = year;
  if (Number.isFinite(itemCount) && itemCount > 0) card.itemCount = itemCount;
  return card;
}

export function mediaFrom(value: unknown): MediaItem | null {
  const item = value as AnyRecord;
  if (!item) return null;
  const kind = cardKindOf(item);
  if (kind) return asCard(item);
  return asTrack(item);
}

export function shelfTitle(section: AnyRecord): string {
  return text(
    section?.header?.title ??
      section?.title ??
      section?.header?.title_text ??
      section?.header?.strapline_text_one,
  );
}

export function buildShelf(section: AnyRecord): Shelf | null {
  const contents = Array.isArray(section?.contents) ? section.contents : [];
  if (contents.length === 0) return null;
  const items = contents
    .map((item: AnyRecord) => mediaFrom(item))
    .filter((item: MediaItem | null): item is MediaItem => Boolean(item));
  if (items.length === 0) return null;
  return { title: shelfTitle(section), items };
}

export function collectSearchItems(response: AnyRecord): AnyRecord[] {
  const output: AnyRecord[] = [];
  const visit = (node: AnyRecord) => {
    if (!node) return;
    if (Array.isArray(node.contents)) {
      for (const child of node.contents) {
        if (child?.type === 'MusicResponsiveListItem' || child?.type === 'MusicTwoRowItem') {
          output.push(child);
        } else if (child?.type === 'MusicCardShelf') {
          visit(child);
        } else if (child?.type === 'MusicShelf' || child?.type === 'ItemSection') {
          visit(child);
        }
      }
    }
  };
  for (const section of response?.contents ?? []) visit(section);
  return output;
}

export function cleanText(value: string | null | undefined): string {
  return String(value ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
