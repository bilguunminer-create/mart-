import React, { useState, useEffect } from 'react';
import { 
  X, 
  Folder, 
  FileText, 
  Image as ImageIcon, 
  FileSpreadsheet, 
  ExternalLink, 
  Trash2, 
  Upload, 
  FolderPlus, 
  RefreshCw, 
  Search, 
  CheckCircle2, 
  AlertTriangle, 
  Download, 
  FileCode,
  HardDrive,
  LogOut,
  ChevronRight,
  Database,
  ShoppingBag,
  Sparkles
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogleDrive, 
  signOutGoogleDrive, 
  getDriveAccessToken, 
  listDriveFiles, 
  createDriveFolder, 
  uploadFileToDrive, 
  deleteDriveFile, 
  getOrCreateStoreFolder, 
  DriveFileItem 
} from '../services/googleDriveService';
import { OrderDetails, Product } from '../types';
import { formatMNT } from '../data/storeData';

interface GoogleDriveModalProps {
  isOpen: boolean;
  onClose: () => void;
  orders: OrderDetails[];
  products: Product[];
  onNotify: (msg: string) => void;
}

export const GoogleDriveModal: React.FC<GoogleDriveModalProps> = ({
  isOpen,
  onClose,
  orders,
  products,
  onNotify,
}) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [isLoadingAuth, setIsLoadingAuth] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'folder' | 'document' | 'image'>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<{ id?: string; name: string }[]>([
    { name: 'Миний Drive' },
  ]);

  // Dialog states
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  
  // Mandatory explicit confirmation dialog for deletion
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Track auth state
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      const activeToken = getDriveAccessToken();
      setToken(activeToken);
      if (u && activeToken) {
        fetchFiles(activeToken, currentFolderId);
      } else {
        setFiles([]);
      }
    });
    return () => unsubscribe();
  }, []);

  const fetchFiles = async (authToken: string, folderId?: string) => {
    setIsLoadingFiles(true);
    try {
      const res = await listDriveFiles(authToken, {
        folderId,
        searchQuery: searchQuery.trim() || undefined,
        mimeTypeFilter: filterType === 'all' ? undefined : filterType,
      });
      setFiles(res.files);
    } catch (err: any) {
      console.error('Error fetching drive files:', err);
      onNotify(err.message || 'Google Drive-с файлуудыг татаж чадсангүй');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  // Trigger search / filter change
  useEffect(() => {
    if (token) {
      fetchFiles(token, currentFolderId);
    }
  }, [filterType, currentFolderId]);

  const handleSignIn = async () => {
    setIsLoadingAuth(true);
    try {
      const res = await signInWithGoogleDrive();
      setUser(res.user);
      setToken(res.accessToken);
      onNotify(`Google Drive-д амжилттай холбогдлоо (${res.user.email})`);
      fetchFiles(res.accessToken, currentFolderId);
    } catch (err: any) {
      console.error('Google Drive sign in failed:', err);
      onNotify(`Нэвтрэхэд алдаа гарлаа: ${err.message}`);
    } finally {
      setIsLoadingAuth(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogleDrive();
    setUser(null);
    setToken(null);
    setFiles([]);
    onNotify('Google Drive-с саллаа.');
  };

  const handleNavigateFolder = (folder: DriveFileItem) => {
    setCurrentFolderId(folder.id);
    setFolderPath((prev) => [...prev, { id: folder.id, name: folder.name }]);
  };

  const handleBreadcrumbClick = (index: number) => {
    const target = folderPath[index];
    setCurrentFolderId(target.id);
    setFolderPath((prev) => prev.slice(0, index + 1));
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !newFolderName.trim()) return;

    try {
      await createDriveFolder(token, newFolderName.trim(), currentFolderId);
      setNewFolderName('');
      setIsCreatingFolder(false);
      onNotify(`"${newFolderName}" хавтас амжилттай үүсгэгдлээ!`);
      fetchFiles(token, currentFolderId);
    } catch (err: any) {
      onNotify(err.message || 'Хавтас үүсгэхэд алдаа гарлаа');
    }
  };

  // Export orders to Google Drive as formatted CSV & JSON
  const handleExportOrdersToDrive = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const targetFolderId = await getOrCreateStoreFolder(token);

      // 1. Generate CSV
      const headers = ['Order ID', 'Date', 'Customer Name', 'Phone', 'District', 'Address', 'Subtotal', 'Discount', 'Delivery Fee', 'Total', 'Payment Method', 'Status'];
      const rows = orders.map((o) => [
        o.orderId,
        o.date,
        `"${(o.customerName || '').replace(/"/g, '""')}"`,
        o.phone,
        `"${(o.district || '').replace(/"/g, '""')}"`,
        `"${(o.address || '').replace(/"/g, '""')}"`,
        o.subtotal,
        (o.dailyDiscount || 0) + (o.loyaltyDiscount || 0),
        o.deliveryFee,
        o.total,
        o.paymentMethod,
        o.status || 'new',
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      const dateStr = new Date().toISOString().slice(0, 10);
      const csvFileName = `USK_Orders_${dateStr}.csv`;
      await uploadFileToDrive(token, {
        fileName: csvFileName,
        mimeType: 'text/csv',
        content: csvContent,
        folderId: targetFolderId,
      });

      // 2. Also export detailed JSON
      const jsonFileName = `USK_Orders_Detailed_${dateStr}.json`;
      await uploadFileToDrive(token, {
        fileName: jsonFileName,
        mimeType: 'application/json',
        content: JSON.stringify(orders, null, 2),
        folderId: targetFolderId,
      });

      onNotify(`Нийт ${orders.length} захиалгын мэдээлэл Google Drive-ын "US&K Family Mart" хавтсанд хадгалагдлаа!`);
      fetchFiles(token, currentFolderId);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || 'Экспорт хийхэд алдаа гарлаа');
    } finally {
      setIsExporting(false);
    }
  };

  // Export product catalog to Google Drive
  const handleExportProductsToDrive = async () => {
    if (!token) return;
    setIsExporting(true);
    try {
      const targetFolderId = await getOrCreateStoreFolder(token);
      const dateStr = new Date().toISOString().slice(0, 10);

      // Product CSV
      const headers = ['ID', 'Name', 'Origin', 'Category', 'Price (MNT)', 'Weight', 'In Stock', 'Rating'];
      const rows = products.map((p) => [
        p.id,
        `"${p.name.replace(/"/g, '""')}"`,
        p.origin,
        `"${p.category_name || p.category}"`,
        p.price,
        `"${p.weight || ''}"`,
        p.in_stock ? 'In Stock' : 'Out of Stock',
        p.rating,
      ]);
      const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');

      await uploadFileToDrive(token, {
        fileName: `USK_Products_Catalog_${dateStr}.csv`,
        mimeType: 'text/csv',
        content: csvContent,
        folderId: targetFolderId,
      });

      onNotify(`Бүх барааны каталог (${products.length} бараа) Google Drive-д амжилттай хадгалагдлаа!`);
      fetchFiles(token, currentFolderId);
    } catch (err: any) {
      console.error(err);
      onNotify(err.message || 'Каталог экспорт хийхэд алдаа гарлаа');
    } finally {
      setIsExporting(false);
    }
  };

  // Mandatory explicit confirmation dialog before deletion
  const confirmDeleteFile = async () => {
    if (!token || !fileToDelete) return;
    setIsDeleting(true);
    try {
      await deleteDriveFile(token, fileToDelete.id);
      onNotify(`"${fileToDelete.name}" файл амжилттай устгагдлаа.`);
      setFileToDelete(null);
      fetchFiles(token, currentFolderId);
    } catch (err: any) {
      onNotify(err.message || 'Файл устгахад алдаа гарлаа');
    } finally {
      setIsDeleting(false);
    }
  };

  const getFileIcon = (file: DriveFileItem) => {
    if (file.mimeType === 'application/vnd.google-apps.folder') {
      return <Folder className="w-5 h-5 text-amber-500 fill-amber-500/20 shrink-0" />;
    }
    if (file.mimeType.includes('sheet') || file.name.endsWith('.csv')) {
      return <FileSpreadsheet className="w-5 h-5 text-emerald-600 shrink-0" />;
    }
    if (file.mimeType.includes('image/')) {
      return <ImageIcon className="w-5 h-5 text-purple-600 shrink-0" />;
    }
    if (file.mimeType.includes('json') || file.name.endsWith('.json')) {
      return <FileCode className="w-5 h-5 text-blue-600 shrink-0" />;
    }
    return <FileText className="w-5 h-5 text-stone-600 shrink-0" />;
  };

  const formatFileSize = (bytes?: string) => {
    if (!bytes) return '-';
    const num = parseInt(bytes, 10);
    if (isNaN(num)) return '-';
    if (num < 1024) return `${num} B`;
    if (num < 1024 * 1024) return `${(num / 1024).toFixed(1)} KB`;
    return `${(num / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden max-h-[92vh] flex flex-col">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-stone-950 via-stone-900 to-stone-950 text-white p-5 relative shrink-0">
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-2 rounded-full text-stone-400 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex flex-wrap items-center justify-between gap-4 pr-10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center shadow-inner">
                {/* Official Google Drive triangle icon */}
                <svg className="w-7 h-7" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                  <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                  <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                  <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                  <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                  <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                  <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
                </svg>
              </div>
              <div>
                <h2 className="text-lg font-bold font-display text-white flex items-center gap-2">
                  <span>Google Drive интеграц</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold border border-emerald-500/30">
                    Active Cloud Storage
                  </span>
                </h2>
                <p className="text-xs text-stone-300">
                  Захиалгын тайлан, нэхэмжлэх, барааны каталогийг өөрийн Google Drive-тай шууд холбож синхрончлох
                </p>
              </div>
            </div>

            {/* Account Status / Log in button */}
            <div>
              {user && token ? (
                <div className="flex items-center gap-3 bg-white/10 px-3 py-1.5 rounded-2xl border border-white/10">
                  {user.photoURL ? (
                    <img src={user.photoURL} alt={user.displayName || 'Google'} className="w-8 h-8 rounded-full border border-white/30" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-rose-600 flex items-center justify-center font-bold text-xs">
                      {user.displayName?.slice(0, 1) || 'G'}
                    </div>
                  )}
                  <div className="text-left">
                    <div className="text-xs font-bold text-white leading-tight">{user.displayName || 'Google Хэрэглэгч'}</div>
                    <div className="text-[11px] text-stone-300 leading-tight">{user.email}</div>
                  </div>
                  <button
                    onClick={handleSignOut}
                    title="Google Drive-с гарах"
                    className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-white/10 transition-colors ml-1"
                  >
                    <LogOut className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                /* Official Styled GSI Sign-in Button */
                <button
                  onClick={handleSignIn}
                  disabled={isLoadingAuth}
                  className="px-4 py-2 bg-white text-stone-800 hover:bg-stone-100 rounded-xl font-semibold text-xs flex items-center gap-2.5 shadow-md transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isLoadingAuth ? 'Холбогдож байна...' : 'Sign in with Google Drive'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 bg-stone-50 border-b border-stone-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* Quick sync store data buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleExportOrdersToDrive}
              disabled={!token || isExporting}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Database className="w-3.5 h-3.5" />
              <span>{isExporting ? 'Хадгалж байна...' : 'Захиалгуудыг Drive-д нөөцлөх (CSV/JSON)'}</span>
            </button>

            <button
              onClick={handleExportProductsToDrive}
              disabled={!token || isExporting}
              className="px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Барааны каталоги экспортлох</span>
            </button>

            <button
              onClick={() => setIsCreatingFolder(true)}
              disabled={!token}
              className="px-3 py-1.5 bg-white border border-stone-300 text-stone-700 hover:bg-stone-100 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5 text-stone-600" />
              <span>Шинэ хавтас</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => token && fetchFiles(token, currentFolderId)}
              disabled={!token || isLoadingFiles}
              className="p-2 bg-white border border-stone-200 hover:bg-stone-100 rounded-xl text-stone-600 transition-colors disabled:opacity-50 cursor-pointer"
              title="Шинэчлэх"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          
          {/* If NOT signed in with Google Drive */}
          {!token ? (
            <div className="py-12 px-4 text-center max-w-lg mx-auto space-y-4">
              <div className="w-16 h-16 rounded-3xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto shadow-inner">
                <HardDrive className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-stone-900">Google Drive-аа холбоно уу</h3>
              <p className="text-xs text-stone-600 leading-relaxed">
                Google Drive ашиглан дэлгүүрийн худалдан авалтын түүх, харилцагчийн нэхэмжлэх, барааны үлдэгдлийн каталогийг cloud диск дээрээ автоматаар хадгалж, ямар ч төхөөрөмжөөс удирдах боломжтой.
              </p>

              <div className="pt-2 flex justify-center">
                <button
                  onClick={handleSignIn}
                  disabled={isLoadingAuth}
                  className="px-6 py-3 bg-stone-900 hover:bg-stone-800 text-white rounded-2xl font-bold text-xs flex items-center gap-3 shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <svg className="w-4 h-4" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                    <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                    <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                  </svg>
                  <span>{isLoadingAuth ? 'Холбогдож байна...' : 'Sign in with Google'}</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-6 text-left text-xs">
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 block mb-1">Захиалгын нөөцлөлт</span>
                  <p className="text-stone-500 text-[11px]">Бүх хийгдсэн захиалгыг CSV болон JSON форматаар хадгална.</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 block mb-1">Барааны бүртгэл</span>
                  <p className="text-stone-500 text-[11px]">АНУ, Солонгос барааны үнэ, үлдэгдлийг хүснэгтэд экспортлоно.</p>
                </div>
                <div className="p-3 bg-stone-50 rounded-xl border border-stone-200">
                  <span className="font-bold text-stone-900 block mb-1">Файл харах & удирдах</span>
                  <p className="text-stone-500 text-[11px]">Google Drive доторх файлуудаа шууд апп дотроос үзэх боломжтой.</p>
                </div>
              </div>
            </div>
          ) : (
            /* Signed-in Google Drive Browser */
            <div className="space-y-4">
              {/* Search & Breadcrumb Bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                {/* Breadcrumbs */}
                <div className="flex items-center gap-1.5 text-xs text-stone-600 overflow-x-auto py-1">
                  {folderPath.map((f, idx) => (
                    <React.Fragment key={idx}>
                      <button
                        onClick={() => handleBreadcrumbClick(idx)}
                        className={`hover:text-rose-600 font-semibold transition-colors flex items-center gap-1 ${
                          idx === folderPath.length - 1 ? 'text-stone-900 font-bold' : 'text-stone-500'
                        }`}
                      >
                        {idx === 0 ? <HardDrive className="w-3.5 h-3.5" /> : <Folder className="w-3.5 h-3.5" />}
                        <span>{f.name}</span>
                      </button>
                      {idx < folderPath.length - 1 && (
                        <ChevronRight className="w-3.5 h-3.5 text-stone-400" />
                      )}
                    </React.Fragment>
                  ))}
                </div>

                {/* Filter Pills */}
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFilterType('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filterType === 'all'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Бүгд
                  </button>
                  <button
                    onClick={() => setFilterType('folder')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filterType === 'folder'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Хавтас
                  </button>
                  <button
                    onClick={() => setFilterType('document')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filterType === 'document'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Баримт / Хүснэгт
                  </button>
                  <button
                    onClick={() => setFilterType('image')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                      filterType === 'image'
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    Зураг
                  </button>
                </div>
              </div>

              {/* Search Box */}
              <div className="relative">
                <Search className="w-4 h-4 text-stone-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && token) {
                      fetchFiles(token, currentFolderId);
                    }
                  }}
                  placeholder="Google Drive дотроос файл хайх (нэрээр хайгаад Enter дарна уу)..."
                  className="w-full pl-10 pr-20 py-2 rounded-xl bg-stone-50 border border-stone-200 text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
                />
                <button
                  onClick={() => token && fetchFiles(token, currentFolderId)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-lg text-[11px] font-bold"
                >
                  Хайх
                </button>
              </div>

              {/* Create Folder Inline Form */}
              {isCreatingFolder && (
                <form
                  onSubmit={handleCreateFolder}
                  className="p-3 bg-amber-50 border border-amber-200 rounded-2xl flex items-center gap-2 animate-fadeIn"
                >
                  <FolderPlus className="w-4 h-4 text-amber-600 shrink-0" />
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Шинэ хавтасны нэр..."
                    autoFocus
                    required
                    className="flex-1 px-3 py-1.5 rounded-xl bg-white border border-amber-300 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500"
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold"
                  >
                    Үүсгэх
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingFolder(false);
                      setNewFolderName('');
                    }}
                    className="px-3 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 rounded-xl text-xs font-semibold"
                  >
                    Болих
                  </button>
                </form>
              )}

              {/* Files Table / List */}
              {isLoadingFiles ? (
                <div className="p-12 text-center text-xs text-stone-500">
                  <RefreshCw className="w-6 h-6 mx-auto mb-2 animate-spin text-stone-400" />
                  Google Drive-с файлуудыг уншиж байна...
                </div>
              ) : files.length === 0 ? (
                <div className="p-12 text-center bg-stone-50 rounded-2xl border border-stone-200 text-stone-500 text-xs space-y-2">
                  <HardDrive className="w-8 h-8 mx-auto text-stone-300" />
                  <p className="font-bold text-stone-700">Энэ хавтас дотор файл олдсонгүй</p>
                  <p className="text-stone-400">
                    Та дээрх "Захиалгуудыг Drive-д нөөцлөх" эсвэл "Барааны каталоги экспортлох" товчоор шууд файл үүсгэж болно.
                  </p>
                </div>
              ) : (
                <div className="border border-stone-200 rounded-2xl overflow-hidden divide-y divide-stone-100 bg-white shadow-xs">
                  {files.map((file) => {
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

                    return (
                      <div
                        key={file.id}
                        className="p-3 flex items-center justify-between gap-3 hover:bg-stone-50/80 transition-colors group"
                      >
                        <div
                          onClick={() => (isFolder ? handleNavigateFolder(file) : null)}
                          className={`flex items-center gap-3 flex-1 min-w-0 ${
                            isFolder ? 'cursor-pointer' : ''
                          }`}
                        >
                          {getFileIcon(file)}
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold text-xs text-stone-900 truncate group-hover:text-rose-600 transition-colors">
                              {file.name}
                            </div>
                            <div className="text-[11px] text-stone-400 flex items-center gap-3 mt-0.5">
                              <span>
                                {file.modifiedTime
                                  ? new Date(file.modifiedTime).toLocaleDateString('mn-MN')
                                  : '-'}
                              </span>
                              {!isFolder && <span>{formatFileSize(file.size)}</span>}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                          {file.webViewLink && (
                            <a
                              href={file.webViewLink}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              title="Google Drive дээр нээх"
                            >
                              <span>Нээх</span>
                              <ExternalLink className="w-3 h-3 text-stone-500" />
                            </a>
                          )}

                          {/* Mandatory explicit confirmation dialog trigger */}
                          <button
                            onClick={() => setFileToDelete(file)}
                            className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Устгах"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-stone-50 border-t border-stone-200 flex items-center justify-between shrink-0 text-xs text-stone-500">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Google Drive API v3 албан ёсны холболт идэвхтэй</span>
          </div>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>

      {/* MANDATORY USER CONFIRMATION DIALOG FOR DELETION */}
      {fileToDelete && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-stone-950/70 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-stone-200 space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-stone-900">Google Drive-аас устгах уу?</h3>
              <p className="text-xs text-stone-600">
                Та <strong>"{fileToDelete.name}"</strong> файлыг Google Drive-аас устгахдаа итгэлтэй байна уу? Энэ үйлдлийг буцаах боломжгүй.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-xs rounded-xl transition-colors cursor-pointer"
              >
                Цуцлах
              </button>
              <button
                type="button"
                onClick={confirmDeleteFile}
                disabled={isDeleting}
                className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white font-bold text-xs rounded-xl shadow-md shadow-red-600/20 transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Устгаж байна...' : 'Тийм, устгах'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
