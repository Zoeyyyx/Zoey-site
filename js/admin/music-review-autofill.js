import { escapeHtml } from "../lib/utils.js";
import { parseNeteaseUrl } from "../services/music-service.js";

function compactSpaces(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function stripFeat(value) {
  return compactSpaces(
    String(value || "")
      .replace(/[（(]\s*(?:feat\.?|ft\.?|featuring)\s+[^）)]*[）)]/gi, "")
      .replace(/\bfeaturing\s+.+$/i, "")
  );
}

function extractFeaturedArtists(lines) {
  const artists = [];
  const pattern = /[（(]\s*(?:feat\.?|ft\.?|featuring)\s+([^）)]*)[）)]|\bfeaturing\s+(.+)$/gi;

  for (const line of lines) {
    let match = pattern.exec(line);
    while (match) {
      const value = compactSpaces(match[1] || match[2] || "");
      if (value) {
        artists.push(value);
      }
      match = pattern.exec(line);
    }
    pattern.lastIndex = 0;
  }

  return [...new Set(artists)];
}

function parseDashedLine(line) {
  const parts = String(line || "")
    .split(/\s+-\s+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length !== 2) {
    return {};
  }

  const [left, right] = parts;
  const lowerRight = right.toLowerCase();
  const likelyArtistOnLeft =
    /^[a-z0-9 .,'&]+$/i.test(left) &&
    !/\b(feat|ft|featuring)\b/i.test(left) &&
    !/\b(colors|song|love|night|rain|city|jack|kerouac)\b/i.test(left);

  if (likelyArtistOnLeft || /^[A-Z][A-Za-z .,'&]+$/.test(left)) {
    return {
      artist_guess: left,
      song_name_guess: stripFeat(right)
    };
  }

  return {
    song_name_guess: stripFeat(left),
    artist_guess: stripFeat(right),
    warnings: lowerRight ? [] : ["无法稳定判断歌手和歌名顺序，可从候选中确认。"]
  };
}

export function parseMusicInput(input) {
  const raw = String(input || "").trim();
  const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsedNetease = parseNeteaseUrl(raw);
  const displayTitle = lines[0] || "";
  const alternateTitle = lines[1] || "";
  const featuredArtists = extractFeaturedArtists(lines);
  const warnings = [];
  let songNameGuess = stripFeat(alternateTitle || displayTitle);
  let artistGuess = "";

  if (parsedNetease.songId || parsedNetease.playlistId) {
    warnings.push("已识别网易云链接；如果无法检索元数据，仍可手动保存。");
    if (/^https?:\/\//i.test(displayTitle)) {
      songNameGuess = parsedNetease.songId ? `网易云歌曲 ${parsedNetease.songId}` : `网易云歌单 ${parsedNetease.playlistId}`;
    }
  }

  const dashed = parseDashedLine(alternateTitle || displayTitle);
  if (dashed.song_name_guess || dashed.artist_guess) {
    songNameGuess = dashed.song_name_guess || songNameGuess;
    artistGuess = dashed.artist_guess || "";
    warnings.push(...(dashed.warnings || []));
  }

  const queryParts = [songNameGuess, artistGuess, stripFeat(alternateTitle), ...featuredArtists]
    .map(compactSpaces)
    .filter(Boolean);
  const query = [...new Set(queryParts)].join(" ") || compactSpaces(raw);

  return {
    query,
    display_title: displayTitle,
    alternate_title: alternateTitle,
    song_name_guess: songNameGuess || displayTitle || "未命名歌曲",
    artist_guess: artistGuess,
    featured_artists: featuredArtists,
    netease_song_id: parsedNetease.songId,
    netease_playlist_id: parsedNetease.playlistId,
    netease_url: parsedNetease.songId || parsedNetease.playlistId ? raw : "",
    warnings
  };
}

export async function searchItunes(query) {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", query);
  url.searchParams.set("media", "music");
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "5");

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`iTunes 搜索失败：${response.status}`);
  }

  const data = await response.json();
  return data.results || [];
}

export async function searchMusicBrainz(query) {
  const url = new URL("https://musicbrainz.org/ws/2/recording/");
  url.searchParams.set("query", query);
  url.searchParams.set("fmt", "json");
  url.searchParams.set("limit", "5");

  const response = await fetch(url.toString(), {
    headers: {
      "accept": "application/json"
    }
  });
  if (!response.ok) {
    throw new Error(`MusicBrainz 搜索失败：${response.status}`);
  }

  const data = await response.json();
  return data.recordings || [];
}

function normalizeItunesCandidate(result) {
  return {
    id: `itunes-${result.trackId}`,
    source: "iTunes",
    title: result.trackName || "",
    artist: result.artistName || "",
    album: result.collectionName || "",
    cover_url: result.artworkUrl100 ? result.artworkUrl100.replace("100x100", "600x600") : "",
    external_music_url: result.trackViewUrl || "",
    preview_url: result.previewUrl || "",
    player_type: result.previewUrl ? "preview" : "external_link",
    is_playable: Boolean(result.previewUrl),
    metadata_source: "itunes",
    metadata_raw: result
  };
}

function normalizeMusicBrainzCandidate(result) {
  const artist = (result["artist-credit"] || [])
    .map((entry) => entry.name || entry.artist?.name || "")
    .filter(Boolean)
    .join(", ");
  const release = result.releases?.[0];

  return {
    id: `musicbrainz-${result.id}`,
    source: "MusicBrainz",
    title: result.title || "",
    artist,
    album: release?.title || "",
    cover_url: "",
    external_music_url: result.id ? `https://musicbrainz.org/recording/${result.id}` : "",
    preview_url: "",
    player_type: "external_link",
    is_playable: false,
    metadata_source: "musicbrainz",
    metadata_raw: result
  };
}

export function normalizeCandidates({ parsed, itunes = [], musicBrainz = [] }) {
  const candidates = [];

  if (parsed.netease_song_id || parsed.netease_playlist_id) {
    candidates.push({
      id: `netease-${parsed.netease_song_id || parsed.netease_playlist_id}`,
      source: "网易云链接",
      title: parsed.song_name_guess,
      artist: parsed.artist_guess,
      album: "",
      cover_url: "",
      netease_song_id: parsed.netease_song_id,
      netease_playlist_id: parsed.netease_playlist_id,
      netease_url: parsed.netease_url,
      external_music_url: parsed.netease_url,
      preview_url: "",
      player_type: parsed.netease_playlist_id ? "netease_playlist" : "netease_song",
      is_playable: true,
      metadata_source: "netease_link",
      metadata_raw: parsed
    });
  }

  candidates.push(...itunes.map(normalizeItunesCandidate));
  candidates.push(...musicBrainz.map(normalizeMusicBrainzCandidate));

  return candidates.filter((candidate) => candidate.title || candidate.artist);
}

export function renderMusicCandidates(candidates, selectedId = "") {
  if (!candidates.length) {
    return '<p class="admin-autofill-empty">未找到候选，可手动填写高级信息。</p>';
  }

  return candidates
    .map((candidate) => `
      <article class="admin-music-candidate${candidate.id === selectedId ? " is-selected" : ""}" data-candidate-id="${escapeHtml(candidate.id)}">
        <div class="admin-music-candidate-cover">
          ${
            candidate.cover_url
              ? `<img src="${escapeHtml(candidate.cover_url)}" alt="${escapeHtml(candidate.title)}" loading="lazy">`
              : "<span>♪</span>"
          }
        </div>
        <div>
          <strong>${escapeHtml(candidate.title || "未命名歌曲")}</strong>
          <span>${escapeHtml(candidate.artist || "未知歌手")}${candidate.album ? ` · ${escapeHtml(candidate.album)}` : ""}</span>
          <small>${escapeHtml(candidate.source)} · ${candidate.is_playable ? "可试听 / 可播放" : "仅元数据 / 外链"}</small>
        </div>
        <button class="admin-secondary-button" type="button" data-use-candidate="${escapeHtml(candidate.id)}">使用这个</button>
      </article>
    `)
    .join("");
}

export function generateNeteaseOutchain(songId) {
  return `https://music.163.com/outchain/player?type=2&id=${encodeURIComponent(songId)}&auto=0&height=66`;
}
