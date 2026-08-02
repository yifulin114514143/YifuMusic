import type {
  Playlist,
  ScanResult,
  Track,
  TrackGroup,
} from '../../generated/typings';
import type { DatabaseBridgeInterface } from '../bridge-database';

// Thank you Pixabay for the copyright-free tracks
const MOCK_TRACKS: Array<Track> = [
  {
    id: '0',
    title: 'Whiskey Blues',
    artists: ['Captain_Sleepy'],
    album: 'Another Album',
    duration: 300,
    album_artist: 'Captain_Sleepy',
    year: 2025,
    disk_no: 1,
    disk_of: 1,
    track_no: 1,
    track_of: 1,
    genres: ['rock', 'blues'],
    path: '/whiskey-blues.mp3',
    is_compilation: false,
  },
  {
    id: '1',
    title: 'Majestic Blues',
    artists: ['Desicomix07'],
    album: 'Pixabay',
    duration: 300,
    album_artist: 'Desicomix07',
    year: 2025,
    disk_no: 1,
    disk_of: 1,
    track_no: 1,
    track_of: 2,
    genres: ['blues'],
    path: '/majestic-blues.mp3',
    is_compilation: false,
  },
  {
    id: '2',
    title: 'Romantic Blues',
    artists: ['Jean-Paul-V'],
    album: 'Pixabay',
    duration: 300,
    album_artist: 'Jean-Paul-V',
    year: 2025,
    disk_no: 1,
    disk_of: 1,
    track_no: 2,
    track_of: 2,
    genres: ['blues'],
    path: '/romantic-blues.mp3',
    is_compilation: false,
  },
];

// Weirdly, when using a class property, accessing it is extremely slow. No idea why. May be a webkit issue.
let tracks: Array<Track> = [];

class DatabaseBridge implements DatabaseBridgeInterface {
  async getAllTracks(): Promise<Array<Track>> {
    return tracks;
  }

  async getTracks(trackIDs: Array<string>): Promise<Array<Track>> {
    return tracks.filter((track) => trackIDs.includes(track.id));
  }

  async updateTrack(_track: Track): Promise<Track> {
    return {} as Track;
  }

  async removeTracks(_trackIDs: Array<string>): Promise<Array<Track>> {
    return [];
  }

  async importTracks(
    _importPaths: Array<string>,
    _refresh = false,
  ): Promise<ScanResult> {
    tracks = MOCK_TRACKS;

    return {
      playlist_count: 0,
      track_count: 0,
      playlist_failures: 0,
      track_failures: 0,
    };
  }

  async getAllArtists(): Promise<Array<string>> {
    return [];
  }

  async getArtistTracks(artist: string): Promise<Array<TrackGroup>> {
    const groups = new Map<string, Array<Track>>();

    for (const track of tracks) {
      if (track.album_artist !== artist || track.is_compilation) continue;

      const albumTracks = groups.get(track.album) ?? [];
      albumTracks.push(track);
      groups.set(track.album, albumTracks);
    }

    return Array.from(groups.entries())
      .map(([label, albumTracks]) => ({
        label,
        genres: Array.from(
          new Set(albumTracks.flatMap((track) => track.genres)),
        ),
        duration: albumTracks.reduce(
          (total, track) => total + track.duration,
          0,
        ),
        year: albumTracks[0]?.year ?? null,
        tracks: albumTracks,
      }))
      .sort((first, second) => {
        const firstYear = first.year ?? Number.MAX_SAFE_INTEGER;
        const secondYear = second.year ?? Number.MAX_SAFE_INTEGER;

        return firstYear - secondYear;
      });
  }

  async hasCompilations(): Promise<boolean> {
    return false;
  }

  async getCompilationAlbums(): Promise<Array<TrackGroup>> {
    return [];
  }

  async getAllPlaylists(): Promise<Array<Playlist>> {
    return [];
  }

  async getPlaylist(_id: string): Promise<Playlist> {
    return {
      id: '0',
      name: 'test playlist',
      tracks: [],
      import_path: null,
    };
  }

  async createPlaylist(_name: string, _ids: Array<string>): Promise<Playlist> {
    return this.getPlaylist('0');
  }

  async renamePlaylist(_id: string, _name: string): Promise<Playlist> {
    return this.getPlaylist('0');
  }

  async setPlaylistTracks(
    _id: string,
    _tracks: Array<string>,
  ): Promise<Playlist> {
    return this.getPlaylist('0');
  }

  async exportPlaylist(_id: string): Promise<void> {
    return;
  }

  async deletePlaylist(_id: string): Promise<void> {
    return;
  }

  async reset(): Promise<string | null> {
    return null;
  }
}

export default new DatabaseBridge();
