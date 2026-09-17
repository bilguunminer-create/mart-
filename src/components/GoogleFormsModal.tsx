import React, { useState, useEffect } from 'react';
import { 
  X, 
  Plus, 
  ExternalLink, 
  RefreshCw, 
  Copy, 
  Check, 
  FileText, 
  MessageSquare, 
  Star, 
  ShoppingBag, 
  Calendar, 
  Users, 
  CheckCircle2, 
  AlertCircle,
  HelpCircle,
  Sparkles,
  Search,
  ChevronRight,
  BarChart3,
  Send
} from 'lucide-react';
import { User } from 'firebase/auth';
import { 
  auth, 
  signInWithGoogleDrive, 
  signOutGoogleDrive, 
  getDriveAccessToken, 
  initDriveAuth 
} from '../services/googleDriveService';
import { 
  listGoogleForms, 
  getGoogleForm, 
  getGoogleFormResponses, 
  createGoogleForm, 
  batchUpdateFormQuestions,
  createSatisfactionSurvey,
  createProductRequestForm,
  GoogleForm,
  FormResponse,
  DriveFormFile
} from '../services/googleFormsService';

interface GoogleFormsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (message: string) => void;
}

export const GoogleFormsModal: React.FC<GoogleFormsModalProps> = ({
  isOpen,
  onClose,
  onNotify,
}) => {
  const [user, setUser] = useState<User | null>(auth.currentUser);
  const [accessToken, setAccessToken] = useState<string | null>(getDriveAccessToken());
  const [isLoading, setIsLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Active sub-tab: 'list' | 'create' | 'responses' | 'preview'
  const [activeTab, setActiveTab] = useState<'list' | 'create' | 'responses'>('list');

  // Forms listing state
  const [forms, setForms] = useState<DriveFormFile[]>([]);
  const [formsLoading, setFormsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Selected form for responses / details
  const [selectedForm, setSelectedForm] = useState<GoogleForm | null>(null);
  const [responses, setResponses] = useState<FormResponse[]>([]);
  const [responsesLoading, setResponsesLoading] = useState(false);

  // Creating form state
  const [isCreating, setIsCreating] = useState(false);
  const [customTitle, setCustomTitle] = useState('');
  const [customDesc, setCustomDesc] = useState('');
  const [customQuestions, setCustomQuestions] = useState<string[]>([
    'Дэлгүүрийн ямар бүтээгдэхүүн хамгийн их таалагдсан бэ?',
    'Хүргэлтийн үйлчилгээ болон сав баглааны талаарх таны сэтгэгдэл?'
  ]);
  const [newQuestionText, setNewQuestionText] = useState('');

  // Copied responder link state
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Listen to auth changes
  useEffect(() => {
    const unsubscribe = initDriveAuth(
      (authedUser, token) => {
        setUser(authedUser);
        setAccessToken(token);
        setAuthError(null);
      },
      () => {
        setUser(auth.currentUser);
        setAccessToken(getDriveAccessToken());
      }
    );
    return () => unsubscribe();
  }, []);

  // Fetch forms when token is available and modal is open
  useEffect(() => {
    if (isOpen && accessToken) {
      loadForms(accessToken);
    }
  }, [isOpen, accessToken]);

  const loadForms = async (token: string) => {
    setFormsLoading(true);
    try {
      const driveForms = await listGoogleForms(token);
      setForms(driveForms);
    } catch (err: any) {
      console.error('Failed to list forms:', err);
      if (onNotify) onNotify(`Google Forms жагсаалт авахад алдаа гарлаа: ${err.message}`);
    } finally {
      setFormsLoading(false);
    }
  };

  const handleSignIn = async () => {
    setIsLoading(true);
    setAuthError(null);
    try {
      const { user: authedUser, accessToken: token } = await signInWithGoogleDrive();
      setUser(authedUser);
      setAccessToken(token);
      if (onNotify) onNotify(`Амжилттай холбогдлоо: ${authedUser.displayName || authedUser.email}`);
      await loadForms(token);
    } catch (err: any) {
      console.error('Google Sign in failed:', err);
      setAuthError(err.message || 'Google хаягаар нэвтрэхэд алдаа гарлаа.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOutGoogleDrive();
    setUser(null);
    setAccessToken(null);
    setForms([]);
    setSelectedForm(null);
    setResponses([]);
    if (onNotify) onNotify('Google хаягаас гарлаа.');
  };

  // Create pre-made Satisfaction Survey
  const handleCreateSatisfactionSurvey = async () => {
    if (!accessToken) return;
    setIsCreating(true);
    try {
      const newForm = await createSatisfactionSurvey(accessToken);
      if (onNotify) onNotify(`Сэтгэл ханамжийн судалгааны форм амжилттай үүсгэгдлээ!`);
      await loadForms(accessToken);
      handleViewFormDetails(newForm.formId);
    } catch (err: any) {
      console.error('Create survey error:', err);
      if (onNotify) onNotify(`Форм үүсгэхэд алдаа гарлаа: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Create pre-made Product Request Form
  const handleCreateProductRequest = async () => {
    if (!accessToken) return;
    setIsCreating(true);
    try {
      const newForm = await createProductRequestForm(accessToken);
      if (onNotify) onNotify(`Захиалгат барааны хүсэлтийн форм амжилттай үүсгэгдлээ!`);
      await loadForms(accessToken);
      handleViewFormDetails(newForm.formId);
    } catch (err: any) {
      console.error('Create product request error:', err);
      if (onNotify) onNotify(`Форм үүсгэхэд алдаа гарлаа: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // Create custom form
  const handleCreateCustomForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !customTitle.trim()) return;
    setIsCreating(true);
    try {
      const newForm = await createGoogleForm(accessToken, customTitle.trim());
      
      const items = customQuestions.filter(q => q.trim().length > 0).map(q => ({
        title: q.trim(),
        questionItem: {
          question: {
            required: false,
            textQuestion: {
              paragraph: true
            }
          }
        }
      }));

      if (items.length > 0 || customDesc.trim()) {
        await batchUpdateFormQuestions(accessToken, newForm.formId, items, customDesc.trim() || undefined);
      }

      if (onNotify) onNotify(`"${customTitle}" шинэ Google Form амжилттай үүслээ!`);
      setCustomTitle('');
      setCustomDesc('');
      await loadForms(accessToken);
      handleViewFormDetails(newForm.formId);
    } catch (err: any) {
      console.error('Custom form creation error:', err);
      if (onNotify) onNotify(`Форм үүсгэхэд алдаа: ${err.message}`);
    } finally {
      setIsCreating(false);
    }
  };

  // View Form Details and Load Responses
  const handleViewFormDetails = async (formId: string) => {
    if (!accessToken) return;
    setResponsesLoading(true);
    setActiveTab('responses');
    try {
      const formDetails = await getGoogleForm(accessToken, formId);
      setSelectedForm(formDetails);
      const responsesData = await getGoogleFormResponses(accessToken, formId);
      setResponses(responsesData.responses);
    } catch (err: any) {
      console.error('Failed to get form details or responses:', err);
      if (onNotify) onNotify(`Формын мэдээлэл авахад алдаа: ${err.message}`);
    } finally {
      setResponsesLoading(false);
    }
  };

  const handleCopyResponderLink = (uri: string, id: string) => {
    navigator.clipboard.writeText(uri);
    setCopiedId(id);
    if (onNotify) onNotify('Судалгаа бөглөх холбоос санах ойд хуулагдлаа!');
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filteredForms = forms.filter(f => 
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-stone-900/60 backdrop-blur-xs animate-in fade-in duration-200"
      id="google-forms-modal-overlay"
    >
      <div 
        id="google-forms-modal-container"
        className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl border border-stone-200 flex flex-col max-h-[92vh] overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 bg-stone-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 border border-purple-200 flex items-center justify-center text-purple-600 shadow-2xs">
              <svg className="w-5 h-5" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="40" height="40" rx="8" fill="#7248B9"/>
                <path d="M14 12H26C27.1 12 28 12.9 28 14V26C28 27.1 27.1 28 26 28H14C12.9 28 12 27.1 12 26V14C12 12.9 12.9 12 14 12Z" fill="white"/>
                <path d="M16 16H24M16 20H24M16 24H21" stroke="#7248B9" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold text-stone-900 tracking-tight">Google Forms Хэрэглэгчийн Санал Асуулга</h2>
                <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                  Google Workspace
                </span>
              </div>
              <p className="text-xs text-stone-500">
                Хэрэглэгчийн сэтгэл ханамж, АНУ & Солонгос барааны хүсэлт авах, хариултуудыг нэгтгэн харах
              </p>
            </div>
          </div>

          <button
            id="google-forms-close-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-stone-200/70 text-stone-400 hover:text-stone-700 flex items-center justify-center transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* User Account Bar */}
        <div className="px-5 py-2.5 bg-purple-50/40 border-b border-purple-100/60 flex flex-wrap items-center justify-between gap-3 text-xs">
          {user ? (
            <div className="flex items-center gap-2.5">
              {user.photoURL ? (
                <img 
                  src={user.photoURL} 
                  alt={user.displayName || 'User'} 
                  referrerPolicy="no-referrer"
                  className="w-6 h-6 rounded-full border border-purple-200 object-cover" 
                />
              ) : (
                <div className="w-6 h-6 rounded-full bg-purple-200 text-purple-800 font-bold flex items-center justify-center text-[10px]">
                  {user.displayName ? user.displayName[0] : 'U'}
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <span className="font-semibold text-stone-800">{user.displayName || 'Google Хэрэглэгч'}</span>
                <span className="text-stone-400">({user.email})</span>
              </div>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-medium">
                <Check className="w-3 h-3" /> Холбогдсон
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-stone-600">
              <AlertCircle className="w-4 h-4 text-amber-500" />
              <span>Google Forms үүсгэх болон хариулт харахын тулд Google хаягаараа нэвтэрнэ үү.</span>
            </div>
          )}

          <div className="flex items-center gap-2">
            {user ? (
              <button
                id="forms-signout-btn"
                onClick={handleSignOut}
                className="px-2.5 py-1 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer text-xs"
              >
                Гарах
              </button>
            ) : (
              <button
                id="forms-signin-btn"
                onClick={handleSignIn}
                disabled={isLoading}
                className="flex items-center gap-2 px-3 py-1.5 bg-white hover:bg-stone-50 text-stone-700 font-medium rounded-lg border border-stone-200 shadow-2xs transition-all cursor-pointer text-xs"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                </svg>
                <span>{isLoading ? 'Холбогдож байна...' : 'Sign in with Google'}</span>
              </button>
            )}
          </div>
        </div>

        {authError && (
          <div className="m-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{authError}</span>
            </div>
            <button 
              onClick={() => setAuthError(null)} 
              className="text-rose-500 hover:text-rose-700 cursor-pointer font-bold px-1"
            >
              ✕
            </button>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="px-5 border-b border-stone-200 flex items-center gap-2 pt-2 bg-white">
          <button
            id="tab-forms-list"
            onClick={() => setActiveTab('list')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'list'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>Миний Формууд ({forms.length})</span>
          </button>

          <button
            id="tab-forms-create"
            onClick={() => setActiveTab('create')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'create'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Шинэ Форм Үүсгэх</span>
          </button>

          <button
            id="tab-forms-responses"
            onClick={() => setActiveTab('responses')}
            className={`pb-2.5 px-3 text-xs font-semibold border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'responses'
                ? 'border-purple-600 text-purple-700'
                : 'border-transparent text-stone-500 hover:text-stone-800'
            }`}
          >
            <BarChart3 className="w-3.5 h-3.5" />
            <span>Хариултууд {selectedForm ? `(${selectedForm.info.title.slice(0, 20)}...)` : ''}</span>
          </button>
        </div>

        {/* Main Content Area */}
        <div className="p-5 overflow-y-auto flex-1 bg-stone-50/50">
          {/* TAB 1: LIST FORMS */}
          {activeTab === 'list' && (
            <div className="space-y-4">
              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Формын нэрээр хайх..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500 transition-all"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <button
                    id="refresh-forms-btn"
                    onClick={() => accessToken && loadForms(accessToken)}
                    disabled={formsLoading || !accessToken}
                    className="px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-700 text-xs font-medium rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                    title="Шинэчлэх"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${formsLoading ? 'animate-spin' : ''}`} />
                    <span>Шинэчлэх</span>
                  </button>

                  <button
                    id="goto-create-tab-btn"
                    onClick={() => setActiveTab('create')}
                    className="px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-2xs flex items-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Шинэ судалгаа үүсгэх</span>
                  </button>
                </div>
              </div>

              {/* Not Logged In Notice */}
              {!accessToken && (
                <div className="p-8 text-center bg-white rounded-2xl border border-stone-200 shadow-2xs my-6">
                  <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-base font-bold text-stone-900 mb-1">Google Forms холболт шаардлагатай</h3>
                  <p className="text-xs text-stone-500 max-w-md mx-auto mb-5 leading-relaxed">
                    US&K Family Mart-ын хэрэглэгчдийн сэтгэл ханамжийн судалгаа болон бараа захиалах формуудыг удирдахын тулд Google хаягаараа холбогдоно уу.
                  </p>
                  <button
                    onClick={handleSignIn}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-md transition-all cursor-pointer"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 48 48">
                      <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                      <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                      <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                      <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    </svg>
                    <span>Google хаягаар холбох</span>
                  </button>
                </div>
              )}

              {/* Forms List Grid */}
              {accessToken && (
                <>
                  {formsLoading ? (
                    <div className="py-12 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                      <span>Google Forms жагсаалтыг ачаалж байна...</span>
                    </div>
                  ) : filteredForms.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-8 shadow-2xs">
                      <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-3">
                        <FileText className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-bold text-stone-800 mb-1">
                        {searchQuery ? 'Хайлтад тохирох форм олдсонгүй' : 'Одоогоор Google Form байхгүй байна'}
                      </h4>
                      <p className="text-xs text-stone-500 mb-4 max-w-sm mx-auto">
                        Дэлгүүрийн сэтгэл ханамжийн судалгаа эсвэл захиалгат барааны хүсэлт авах бэлэн загварыг 1 товшилтоор үүсгээрэй.
                      </p>
                      <button
                        onClick={() => setActiveTab('create')}
                        className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl shadow-2xs inline-flex items-center gap-1.5 transition-all cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Бэлэн загвар ашиглан үүсгэх</span>
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {filteredForms.map((form) => (
                        <div
                          key={form.id}
                          className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs hover:shadow-md hover:border-purple-200 transition-all flex flex-col justify-between"
                        >
                          <div>
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-purple-100/80 text-purple-700 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <h4 className="text-xs font-bold text-stone-900 line-clamp-1" title={form.name}>
                                  {form.name}
                                </h4>
                              </div>
                              <span className="text-[10px] text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded shrink-0">
                                Form
                              </span>
                            </div>

                            <div className="text-[11px] text-stone-500 space-y-1 mb-3">
                              {form.modifiedTime && (
                                <div className="flex items-center gap-1.5 text-stone-400">
                                  <Calendar className="w-3 h-3" />
                                  <span>Өөрчилсөн: {new Date(form.modifiedTime).toLocaleDateString('mn-MN')}</span>
                                </div>
                              )}
                              <div className="text-[10px] font-mono text-stone-400 truncate">
                                ID: {form.id}
                              </div>
                            </div>
                          </div>

                          <div className="pt-3 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                            <button
                              onClick={() => handleViewFormDetails(form.id)}
                              className="px-2.5 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 font-semibold rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                            >
                              <BarChart3 className="w-3.5 h-3.5" />
                              <span>Хариултууд</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              {form.webViewLink && (
                                <a
                                  href={form.webViewLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1.5 text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded-lg transition-colors cursor-pointer"
                                  title="Google Forms-д засах"
                                >
                                  <ExternalLink className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => handleCopyResponderLink(`https://docs.google.com/forms/d/e/${form.id}/viewform`, form.id)}
                                className="p-1.5 text-stone-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors cursor-pointer"
                                title="Судалгааны линк хуулах"
                              >
                                {copiedId === form.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* TAB 2: CREATE FORMS (TEMPLATES & CUSTOM) */}
          {activeTab === 'create' && (
            <div className="space-y-6 max-w-2xl mx-auto">
              {/* Template Presets for US&K Family Mart */}
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Sparkles className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-stone-900">Бэлэн Загварууд (1-Click Templates)</h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  {/* Template 1: Satisfaction Survey */}
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center mb-2.5">
                        <Star className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 mb-1">
                        Хэрэглэгчийн сэтгэл ханамжийн судалгаа
                      </h4>
                      <p className="text-[11px] text-stone-500 leading-relaxed mb-3">
                        Хүргэлтийн хурд, барааны чанар (АНУ/БНСУ), дуртай бүтээгдэхүүний төрөл, оноо цуглуулах хэрэглэгчийн утасны дугаарыг асуух бэлэн форм.
                      </p>
                    </div>

                    <button
                      id="create-satisfaction-survey-btn"
                      onClick={handleCreateSatisfactionSurvey}
                      disabled={isCreating || !accessToken}
                      className="w-full py-2 px-3 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Энэ загварыг үүсгэх</span>
                    </button>
                  </div>

                  {/* Template 2: Custom Product Import Request */}
                  <div className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs hover:border-purple-300 hover:shadow-md transition-all flex flex-col justify-between">
                    <div>
                      <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center mb-2.5">
                        <ShoppingBag className="w-4 h-4" />
                      </div>
                      <h4 className="text-xs font-bold text-stone-900 mb-1">
                        Захиалгат бараа нийлүүлэх хүсэлт
                      </h4>
                      <p className="text-[11px] text-stone-500 leading-relaxed mb-3">
                        Хэрэглэгч АНУ Costco эсвэл Солонгосоос дэлгүүрт байхгүй тусгай бараа (витамин, амттан, бэлдмэл) захиалах хүсэлтийн систем.
                      </p>
                    </div>

                    <button
                      id="create-product-request-btn"
                      onClick={handleCreateProductRequest}
                      disabled={isCreating || !accessToken}
                      className="w-full py-2 px-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-2xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Энэ загварыг үүсгэх</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Custom Form Builder */}
              <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-2xs">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-purple-600" />
                  <h3 className="text-sm font-bold text-stone-900">Өөрийн тусгай Google Form үүсгэх</h3>
                </div>

                <form onSubmit={handleCreateCustomForm} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Формын нэр (Гарчиг) *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="Жишээ: US&K Family Mart - Хаврын урамшууллын санал асуулга"
                      value={customTitle}
                      onChange={(e) => setCustomTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Тайлбар (Заавал биш)
                    </label>
                    <textarea
                      rows={2}
                      placeholder="Хэрэглэгчдэд зориулсан тайлбар текст..."
                      value={customDesc}
                      onChange={(e) => setCustomDesc(e.target.value)}
                      className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-stone-800 focus:outline-none focus:ring-2 focus:ring-purple-500/20 focus:border-purple-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-stone-700 mb-1">
                      Асуултууд ({customQuestions.length})
                    </label>
                    <div className="space-y-2 mb-2">
                      {customQuestions.map((q, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center shrink-0">
                            {idx + 1}
                          </span>
                          <input
                            type="text"
                            value={q}
                            onChange={(e) => {
                              const updated = [...customQuestions];
                              updated[idx] = e.target.value;
                              setCustomQuestions(updated);
                            }}
                            className="flex-1 px-3 py-1.5 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-800"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setCustomQuestions(customQuestions.filter((_, i) => i !== idx));
                            }}
                            className="text-stone-400 hover:text-rose-500 p-1 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        placeholder="Шинэ асуулт бичих..."
                        value={newQuestionText}
                        onChange={(e) => setNewQuestionText(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            if (newQuestionText.trim()) {
                              setCustomQuestions([...customQuestions, newQuestionText.trim()]);
                              setNewQuestionText('');
                            }
                          }
                        }}
                        className="flex-1 px-3 py-1.5 bg-white border border-stone-200 rounded-lg text-xs text-stone-800"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (newQuestionText.trim()) {
                            setCustomQuestions([...customQuestions, newQuestionText.trim()]);
                            setNewQuestionText('');
                          }
                        }}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium cursor-pointer"
                      >
                        Нэмэх
                      </button>
                    </div>
                  </div>

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isCreating || !accessToken || !customTitle.trim()}
                      className="px-4 py-2.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-semibold text-xs rounded-xl shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                    >
                      {isCreating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                      <span>Google Form Үүсгэх</span>
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* TAB 3: RESPONSES VIEWER */}
          {activeTab === 'responses' && (
            <div className="space-y-4">
              {!selectedForm ? (
                <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-8 shadow-2xs">
                  <BarChart3 className="w-10 h-10 text-stone-300 mx-auto mb-2" />
                  <h4 className="text-sm font-bold text-stone-800 mb-1">Форм сонгогдоогүй байна</h4>
                  <p className="text-xs text-stone-500 mb-4">
                    Хариултыг харахын тулд эхлээд "Миний Формууд" цэснээс форм сонгоно уу.
                  </p>
                  <button
                    onClick={() => setActiveTab('list')}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl cursor-pointer"
                  >
                    Формын жагсаалт руу очих
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Selected Form Header */}
                  <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
                        <h3 className="text-sm font-bold text-stone-900">{selectedForm.info.title}</h3>
                      </div>
                      {selectedForm.info.description && (
                        <p className="text-xs text-stone-500 mt-1">{selectedForm.info.description}</p>
                      )}
                      <div className="flex items-center gap-3 mt-2 text-[11px] text-stone-400">
                        <span>Нийт асуулт: {selectedForm.items?.length || 0}</span>
                        <span>•</span>
                        <span className="font-semibold text-purple-700">Ирсэн хариулт: {responses.length}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleViewFormDetails(selectedForm.formId)}
                        disabled={responsesLoading}
                        className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-medium rounded-xl flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${responsesLoading ? 'animate-spin' : ''}`} />
                        <span>Шинэчлэх</span>
                      </button>

                      {selectedForm.responderUri && (
                        <a
                          href={selectedForm.responderUri}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                          <span>Судалгаа бөглөх</span>
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Responses Content */}
                  {responsesLoading ? (
                    <div className="py-12 text-center text-stone-500 text-xs flex flex-col items-center gap-2">
                      <RefreshCw className="w-5 h-5 animate-spin text-purple-600" />
                      <span>Хариултуудыг Google Forms API-аас ачаалж байна...</span>
                    </div>
                  ) : responses.length === 0 ? (
                    <div className="py-12 text-center bg-white rounded-2xl border border-stone-200 p-8 shadow-2xs">
                      <Users className="w-8 h-8 text-stone-300 mx-auto mb-2" />
                      <h4 className="text-sm font-bold text-stone-800 mb-1">Одоогоор ирсэн хариулт алга байна</h4>
                      <p className="text-xs text-stone-500 max-w-sm mx-auto mb-4">
                        Та доорх холбоосыг хуулж хэрэглэгчдэд илгээх эсвэл өөрөө туршилтын хариулт илгээнэ үү.
                      </p>
                      {selectedForm.responderUri && (
                        <button
                          onClick={() => handleCopyResponderLink(selectedForm.responderUri!, selectedForm.formId)}
                          className="inline-flex items-center gap-1.5 px-4 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold rounded-xl cursor-pointer"
                        >
                          {copiedId === selectedForm.formId ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>Судалгааны линк хуулах</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-xs text-stone-500 font-medium px-1">
                        <span>Ирсэн хариултуудын түүх ({responses.length})</span>
                      </div>

                      {responses.map((resp, idx) => (
                        <div
                          key={resp.responseId || idx}
                          className="bg-white rounded-xl border border-stone-200 p-4 shadow-2xs space-y-2.5"
                        >
                          <div className="flex items-center justify-between text-[11px] pb-2 border-b border-stone-100">
                            <div className="flex items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-purple-100 text-purple-700 font-bold text-[10px] flex items-center justify-center">
                                #{idx + 1}
                              </span>
                              <span className="font-semibold text-stone-800">
                                {resp.respondentEmail || 'Нэргүй хэрэглэгч'}
                              </span>
                            </div>
                            <span className="text-stone-400">
                              {new Date(resp.lastSubmittedTime || resp.createTime).toLocaleString('mn-MN')}
                            </span>
                          </div>

                          {/* Answers breakdown */}
                          <div className="space-y-2 text-xs">
                            {resp.answers && Object.entries(resp.answers).map(([qId, ans]: [string, any]) => {
                              // Find matching question title from form items
                              const item = selectedForm.items?.find(
                                it => it.questionItem?.question?.questionId === qId
                              );
                              const title = item ? item.title : `Асуулт (${qId.slice(-6)})`;
                              const values = ans?.textAnswers?.answers?.map((a: any) => a.value).join(', ') || 'Хоосон';

                              return (
                                <div key={qId} className="bg-stone-50/70 p-2.5 rounded-lg border border-stone-100">
                                  <div className="text-[11px] font-medium text-stone-500 mb-1">{title}</div>
                                  <div className="font-semibold text-stone-900">{values}</div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-stone-200 bg-white flex items-center justify-between text-xs text-stone-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-600"></span>
            <span>Google Forms API v1 & Drive Storage</span>
          </div>

          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 font-medium rounded-lg transition-colors cursor-pointer"
          >
            Хаах
          </button>
        </div>
      </div>
    </div>
  );
};
