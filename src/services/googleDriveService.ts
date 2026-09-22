import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithPopup, 
  GoogleAuthProvider, 
  onAuthStateChanged, 
  User, 
  signOut 
} from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

// Initialize Firebase App instance safely (no duplicate initialization)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);

// All Google Workspace (Drive & Forms) scopes configured for the app
export const WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/drive',
  'https://www.googleapis.com/auth/drive.activity',
  'https://www.googleapis.com/auth/drive.activity.readonly',
  'https://www.googleapis.com/auth/drive.appdata',
  'https://www.googleapis.com/auth/drive.apps.readonly',
  'https://www.googleapis.com/auth/drive.file',
  'https://www.googleapis.com/auth/drive.install',
  'https://www.googleapis.com/auth/drive.meet.readonly',
  'https://www.googleapis.com/auth/drive.metadata',
  'https://www.googleapis.com/auth/drive.metadata.readonly',
  'https://www.googleapis.com/auth/drive.photos.readonly',
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/drive.scripts',
  'https://www.googleapis.com/auth/forms.body',
  'https://www.googleapis.com/auth/forms.body.readonly',
  'https://www.googleapis.com/auth/forms.responses.readonly',
];

export const DRIVE_SCOPES = WORKSPACE_SCOPES;

const provider = new GoogleAuthProvider();
WORKSPACE_SCOPES.forEach((scope) => {
  provider.addScope(scope);
});
provider.setCustomParameters({
  prompt: 'select_account',
});

// Flag to track signing in state
let isSigningIn = false;

// Cached in-memory token (MANDATORY: never stored in localStorage or sessionStorage)
let cachedAccessToken: string | null = null;

export const initDriveAuth = (
  onAuthSuccess?: (user: User, token: string) => void,
  onAuthFailure?: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user) {
      if (cachedAccessToken) {
        if (onAuthSuccess) onAuthSuccess(user, cachedAccessToken);
      } else if (!isSigningIn) {
        // Token not cached yet (e.g. page refreshed)
        if (onAuthFailure) onAuthFailure();
      }
    } else {
      cachedAccessToken = null;
      if (onAuthFailure) onAuthFailure();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Google Drive access token олгогдсонгүй. Дахин оролдоно уу.');
    }

    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Drive Sign in error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const signOutGoogleDrive = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  iconLink?: string;
  webViewLink?: string;
  webContentLink?: string;
  thumbnailLink?: string;
  size?: string;
  modifiedTime?: string;
  trashed?: boolean;
  parents?: string[];
}

/**
 * List files from user's Google Drive
 */
export const listDriveFiles = async (
  accessToken: string,
  options: {
    folderId?: string;
    searchQuery?: string;
    pageSize?: number;
    mimeTypeFilter?: string;
  } = {}
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> => {
  const { folderId, searchQuery, pageSize = 30, mimeTypeFilter } = options;

  let queryParts: string[] = ['trashed = false'];

  if (folderId) {
    queryParts.push(`'${folderId}' in parents`);
  }

  if (searchQuery && searchQuery.trim()) {
    const escaped = searchQuery.replace(/'/g, "\\'");
    queryParts.push(`name contains '${escaped}'`);
  }

  if (mimeTypeFilter) {
    if (mimeTypeFilter === 'folder') {
      queryParts.push("mimeType = 'application/vnd.google-apps.folder'");
    } else if (mimeTypeFilter === 'document') {
      queryParts.push("(mimeType contains 'document' or mimeType contains 'sheet' or mimeType contains 'text' or mimeType contains 'json' or mimeType contains 'csv')");
    } else if (mimeTypeFilter === 'image') {
      queryParts.push("mimeType contains 'image/'");
    }
  }

  const q = queryParts.join(' and ');
  const url = new URL('https://www.googleapis.com/drive/v3/files');
  url.searchParams.set('q', q);
  url.searchParams.set('pageSize', pageSize.toString());
  url.searchParams.set(
    'fields',
    'nextPageToken, files(id, name, mimeType, iconLink, webViewLink, webContentLink, thumbnailLink, size, modifiedTime, trashed, parents)'
  );
  url.searchParams.set('orderBy', 'folder desc, modifiedTime desc');

  const response = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Google Drive API алдаа (${response.status}): ${errText}`);
  }

  const data = await response.json();
  return {
    files: data.files || [],
    nextPageToken: data.nextPageToken,
  };
};

/**
 * Create a new folder in Google Drive
 */
export const createDriveFolder = async (
  accessToken: string,
  folderName: string,
  parentId?: string
): Promise<DriveFileItem> => {
  const metadata: any = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder',
  };
  if (parentId) {
    metadata.parents = [parentId];
  }

  const response = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(metadata),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Хавтас үүсгэж чадсангүй: ${err}`);
  }

  return await response.json();
};

/**
 * Upload text/JSON/CSV file using multipart Google Drive upload
 */
export const uploadFileToDrive = async (
  accessToken: string,
  options: {
    fileName: string;
    mimeType: string;
    content: string | Blob;
    folderId?: string;
  }
): Promise<DriveFileItem> => {
  const { fileName, mimeType, content, folderId } = options;

  const metadata: any = {
    name: fileName,
    mimeType: mimeType,
  };
  if (folderId) {
    metadata.parents = [folderId];
  }

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const bodyContent = typeof content === 'string' ? content : await content.text();

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n\r\n` +
    bodyContent +
    closeDelimiter;

  const response = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Файл хуулахад алдаа гарлаа: ${err}`);
  }

  return await response.json();
};

/**
 * Delete a file or folder from Google Drive
 * (NOTE: caller MUST always present user confirmation dialog before invoking)
 */
export const deleteDriveFile = async (accessToken: string, fileId: string): Promise<void> => {
  const response = await fetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok && response.status !== 204) {
    const err = await response.text();
    throw new Error(`Файл устгахад алдаа гарлаа: ${err}`);
  }
};

/**
 * Get or create "US&K Family Mart" root folder in user's Drive
 */
export const getOrCreateStoreFolder = async (accessToken: string): Promise<string> => {
  const folderName = 'US&K Family Mart - Data & Invoices';
  const searchResult = await listDriveFiles(accessToken, {
    searchQuery: folderName,
    mimeTypeFilter: 'folder',
  });

  const existing = searchResult.files.find(
    (f) => f.name === folderName && f.mimeType === 'application/vnd.google-apps.folder'
  );
  if (existing) {
    return existing.id;
  }

  const created = await createDriveFolder(accessToken, folderName);
  return created.id;
};
