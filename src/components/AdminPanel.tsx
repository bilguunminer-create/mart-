import React, { useState } from 'react';
import { 
  Package, 
  ShoppingBag, 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Check, 
  X, 
  ArrowLeft, 
  Truck, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  Phone, 
  MapPin, 
  RotateCcw, 
  KeyRound, 
  Sparkles,
  DollarSign,
  Layers,
  Image as ImageIcon,
  LogOut
} from 'lucide-react';
import { Product, OrderDetails } from '../types';
import { CATEGORIES, formatMNT } from '../data/storeData';
import { ProductFormModal } from './ProductFormModal';

interface AdminPanelProps {
  products: Product[];
  orders: OrderDetails[];
  onSaveProduct: (product: Product) => void;
  onDeleteProduct: (productId: string) => void;
  onToggleStock: (productId: string) => void;
  onUpdateOrderStatus: (orderId: string, status: 'new' | 'confirmed' | 'shipping' | 'delivered' | 'cancelled') => void;
  onResetProducts: () => void;
  onClose: () => void;
  onLogout?: () => void;
  adminPin: string;
  onChangePin: (newPin: string) => void;
}

export const AdminPanel: React.FC<AdminPanelProps> = ({
  products,
  orders,
  onSaveProduct,
  onDeleteProduct,
  onToggleStock,
  onUpdateOrderStatus,
  onResetProducts,
  onClose,
  onLogout,
  adminPin,
  onChangePin
}) => {
  const [activeTab, setActiveTab] = useState<'products' | 'orders' | 'stats' | 'settings'>('products');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedOrigin, setSelectedOrigin] = useState<'ALL' | 'KR' | 'US'>('ALL');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');

  // Product Form Modal state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);

  // Delete confirmation
  const [deletingProductId, setDeletingProductId] = useState<string | null>(null);

  // Orders status filter
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');

  // New PIN input
  const [newPin, setNewPin] = useState('');
  const [pinChangeMsg, setPinChangeMsg] = useState<string | null>(null);

  // Reset confirmation
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Filter products
  const filteredProducts = products.filter((prod) => {
    const matchesSearch = prod.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.category_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          prod.id.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || prod.category === selectedCategory;
    const matchesOrigin = selectedOrigin === 'ALL' || prod.origin === selectedOrigin;
    const matchesStock = stockFilter === 'all' 
      ? true 
      : stockFilter === 'in_stock' ? prod.in_stock : !prod.in_stock;

    return matchesSearch && matchesCat && matchesOrigin && matchesStock;
  });

  // Filter orders
  const filteredOrders = orders.filter((order) => {
    if (orderStatusFilter === 'all') return true;
    return (order.status || 'new') === orderStatusFilter;
  });

  // Stats calculation
  const totalProducts = products.length;
  const inStockCount = products.filter(p => p.in_stock).length;
  const outOfStockCount = totalProducts - inStockCount;
  const totalOrders = orders.length;
  const newOrdersCount = orders.filter(o => !o.status || o.status === 'new').length;
  const totalRevenue = orders
    .filter(o => o.status !== 'cancelled')
    .reduce((sum, o) => sum + o.total, 0);

  const handleOpenAdd = () => {
    setEditingProduct(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setIsFormOpen(true);
  };

  const confirmDelete = (id: string) => {
    onDeleteProduct(id);
    setDeletingProductId(null);
  };

  const handleSavePin = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPin.trim().length >= 4) {
      onChangePin(newPin.trim());
      setPinChangeMsg('ПИН код амжилттай шинэчлэгдлээ!');
      setNewPin('');
      setTimeout(() => setPinChangeMsg(null), 3000);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status) {
      case 'confirmed':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800">Баталгаажсан</span>;
      case 'shipping':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800">Хүргэлтэд гарсан</span>;
      case 'delivered':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">Хүргэгдсэн</span>;
      case 'cancelled':
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-800">Цуцлагдсан</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 animate-pulse">Шинэ захиалга</span>;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-stone-100 overflow-y-auto flex flex-col">
      {/* Admin Top Header */}
      <header className="sticky top-0 z-30 bg-stone-900 text-white shadow-md border-b border-stone-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white transition-colors cursor-pointer flex items-center gap-1.5 text-xs font-bold"
              title="Дэлгүүр рүү буцах"
            >
              <ArrowLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Дэлгүүр рүү буцах</span>
            </button>
            <div className="h-5 w-px bg-stone-700 hidden sm:block" />
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-rose-600 text-white font-black text-xs flex items-center justify-center">
                US&K
              </div>
              <h1 className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                Админ Удирдлага
              </h1>
            </div>
          </div>

          {/* Quick Stats in Header for Desktop */}
          <div className="flex items-center gap-2 sm:gap-4">
            <div className="hidden md:flex items-center gap-3 text-xs text-stone-300 bg-stone-800/80 px-3 py-1.5 rounded-xl border border-stone-700">
              <span>Нийт: <strong className="text-white">{totalProducts}</strong> бараа</span>
              <span>•</span>
              <span>Шинэ: <strong className="text-amber-400">{newOrdersCount}</strong> захиалга</span>
            </div>

            {onLogout && (
              <button
                onClick={() => {
                  onLogout();
                  onClose();
                }}
                className="px-3 py-1.5 bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white text-xs font-semibold rounded-xl border border-stone-700 transition-all cursor-pointer flex items-center gap-1.5"
                title="Админ горимоос гарч хэрэглэгчийн харагдац руу шилжих"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span className="hidden sm:inline">Гарах</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl transition-all shadow-xs cursor-pointer flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              <span>Хаах</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-4 flex gap-2 border-t border-stone-800/60 overflow-x-auto">
          <button
            id="admin-tab-products"
            onClick={() => setActiveTab('products')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'products'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <Package className="w-4 h-4" />
            <span>Бараа бүтээгдэхүүн</span>
            <span className="px-1.5 py-0.2 rounded-full bg-stone-800 text-[10px] text-stone-300">
              {totalProducts}
            </span>
          </button>

          <button
            id="admin-tab-orders"
            onClick={() => setActiveTab('orders')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'orders'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Ирсэн захиалгууд</span>
            {newOrdersCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-rose-600 text-[10px] text-white font-bold animate-pulse">
                {newOrdersCount} шинэ
              </span>
            )}
          </button>

          <button
            id="admin-tab-stats"
            onClick={() => setActiveTab('stats')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'stats'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>Хяналтын тойм</span>
          </button>

          <button
            id="admin-tab-settings"
            onClick={() => setActiveTab('settings')}
            className={`py-3 px-4 text-xs font-bold border-b-2 transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
              activeTab === 'settings'
                ? 'border-rose-500 text-rose-400'
                : 'border-transparent text-stone-400 hover:text-stone-200'
            }`}
          >
            <RotateCcw className="w-4 h-4" />
            <span>Тохиргоо & Сэргээх</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
        {/* ================= PRODUCTS TAB ================= */}
        {activeTab === 'products' && (
          <div className="space-y-4">
            {/* Top Toolbar */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
              <div className="flex-1 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                {/* Search */}
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Барааны нэр, кодоор хайх..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-stone-50 focus:bg-white"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 hover:text-stone-600 text-xs"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Category Filter */}
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="all">Бүх ангилал ({products.length})</option>
                  {CATEGORIES.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>

                {/* Origin Filter */}
                <select
                  value={selectedOrigin}
                  onChange={(e) => setSelectedOrigin(e.target.value as any)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="ALL">Бүх улс</option>
                  <option value="KR">🇰🇷 БНСУ</option>
                  <option value="US">🇺🇸 АНУ</option>
                </select>

                {/* Stock Filter */}
                <select
                  value={stockFilter}
                  onChange={(e) => setStockFilter(e.target.value as any)}
                  className="px-3 py-2 text-xs border border-stone-200 rounded-xl focus:outline-none focus:border-rose-500 bg-white"
                >
                  <option value="all">Бүх төлөв</option>
                  <option value="in_stock">Бэлэн байгаа ({inStockCount})</option>
                  <option value="out_of_stock">Дууссан ({outOfStockCount})</option>
                </select>
              </div>

              {/* Add Product Button */}
              <button
                id="admin-add-product-btn"
                onClick={handleOpenAdd}
                className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Шинэ бараа нэмэх</span>
              </button>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  className={`bg-white rounded-2xl border transition-all shadow-xs hover:shadow-md flex flex-col overflow-hidden ${
                    !prod.in_stock ? 'border-amber-200 bg-stone-50/50' : 'border-stone-200'
                  }`}
                >
                  {/* Image container */}
                  <div className="relative h-44 bg-stone-100 overflow-hidden group">
                    <img
                      src={prod.image}
                      alt={prod.name}
                      className={`w-full h-full object-cover transition-transform group-hover:scale-105 duration-300 ${
                        !prod.in_stock ? 'grayscale opacity-75' : ''
                      }`}
                    />
                    <div className="absolute top-2 left-2 flex flex-col gap-1 items-start">
                      <span className="bg-white/95 backdrop-blur-xs px-2 py-0.5 rounded-md text-[10px] font-bold text-stone-800 shadow-xs flex items-center gap-1">
                        <span>{prod.flag}</span>
                        <span>{prod.country}</span>
                      </span>
                      {prod.badge && (
                        <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-xs ${prod.badge_color || 'bg-rose-500'}`}>
                          {prod.badge}
                        </span>
                      )}
                    </div>

                    <div className="absolute top-2 right-2">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold shadow-xs ${
                        prod.in_stock 
                          ? 'bg-emerald-500 text-white' 
                          : 'bg-stone-800 text-amber-300'
                      }`}>
                        {prod.in_stock ? 'Бэлэн' : 'Дууссан'}
                      </span>
                    </div>

                    {/* Quick In-Stock switch overlay on hover */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(prod)}
                        className="p-2 bg-white text-stone-900 rounded-xl hover:bg-rose-50 hover:text-rose-600 transition-all font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Засах</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleStock(prod.id)}
                        className={`p-2 rounded-xl text-white font-bold text-xs flex items-center gap-1 shadow-md cursor-pointer ${
                          prod.in_stock ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        <span>{prod.in_stock ? 'Дууссан болгох' : 'Бэлэн болгох'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-3.5 flex-1 flex flex-col justify-between space-y-2">
                    <div>
                      <div className="flex items-center justify-between text-[11px] text-stone-400 mb-1">
                        <span className="font-mono">{prod.id}</span>
                        <span>{prod.category_name}</span>
                      </div>
                      <h4 className="font-extrabold text-stone-900 text-xs sm:text-sm line-clamp-2 leading-snug">
                        {prod.name}
                      </h4>
                      <p className="text-[11px] text-stone-500 mt-1 line-clamp-1">
                        {prod.weight} • {prod.description}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                      <div>
                        <span className="text-[10px] text-stone-400 block">Үнэ:</span>
                        <span className="font-black text-rose-600 text-sm">{formatMNT(prod.price)}</span>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenEdit(prod)}
                          className="p-1.5 text-stone-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Барааны мэдээлэл, зураг засах"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeletingProductId(prod.id)}
                          className="p-1.5 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                          title="Устгах"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                <Package className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                <p className="font-bold text-stone-700 text-sm">Хайлтад тохирох бараа олдсонгүй</p>
                <p className="text-xs text-stone-400 mt-1">Шүүлтүүрээ өөрчлөх эсвэл шинээр бараа нэмнэ үү.</p>
              </div>
            )}
          </div>
        )}

        {/* ================= ORDERS TAB ================= */}
        {activeTab === 'orders' && (
          <div className="space-y-4">
            {/* Orders Filter */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-stone-700 mr-2">Төлөв:</span>
                {[
                  { id: 'all', label: `Бүгд (${orders.length})` },
                  { id: 'new', label: `Шинэ (${orders.filter(o => !o.status || o.status === 'new').length})` },
                  { id: 'confirmed', label: `Баталгаажсан (${orders.filter(o => o.status === 'confirmed').length})` },
                  { id: 'shipping', label: `Хүргэлтэд (${orders.filter(o => o.status === 'shipping').length})` },
                  { id: 'delivered', label: `Хүргэгдсэн (${orders.filter(o => o.status === 'delivered').length})` },
                  { id: 'cancelled', label: `Цуцлагдсан (${orders.filter(o => o.status === 'cancelled').length})` }
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setOrderStatusFilter(f.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      orderStatusFilter === f.id
                        ? 'bg-stone-900 text-white'
                        : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              <span className="text-xs text-stone-400">
                Сүүлийн захиалгууд эхэндээ харагдана
              </span>
            </div>

            {/* Orders List */}
            <div className="space-y-3">
              {filteredOrders.map((order) => {
                const currentStatus = order.status || 'new';

                return (
                  <div
                    key={order.orderId}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all p-5 space-y-4"
                  >
                    {/* Top Order Row */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-stone-100">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-black text-sm text-stone-900 bg-stone-100 px-2.5 py-1 rounded-lg">
                          #{order.orderId}
                        </span>
                        {getStatusBadge(currentStatus)}
                        <span className="text-xs text-stone-400 flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          <span>{order.date}</span>
                        </span>
                      </div>

                      {/* Status changer select */}
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-stone-500 font-semibold">Төлөв солих:</span>
                        <select
                          value={currentStatus}
                          onChange={(e) => onUpdateOrderStatus(order.orderId, e.target.value as any)}
                          className="text-xs font-bold border border-stone-300 rounded-xl px-2.5 py-1.5 bg-stone-50 focus:outline-none focus:border-rose-500 cursor-pointer"
                        >
                          <option value="new">Шинэ</option>
                          <option value="confirmed">Баталгаажсан</option>
                          <option value="shipping">Хүргэлтэд гарсан</option>
                          <option value="delivered">Хүргэгдсэн</option>
                          <option value="cancelled">Цуцлагдсан</option>
                        </select>
                      </div>
                    </div>

                    {/* Middle Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                      {/* Customer Info */}
                      <div className="space-y-1">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Хэрэглэгч
                        </span>
                        <p className="font-bold text-stone-900 text-sm">{order.customerName}</p>
                        <a
                          href={`tel:${order.phone}`}
                          className="inline-flex items-center gap-1.5 text-rose-600 font-bold hover:underline"
                        >
                          <Phone className="w-3.5 h-3.5" />
                          <span>{order.phone} (Залгах)</span>
                        </a>
                      </div>

                      {/* Delivery Address */}
                      <div className="space-y-1">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Хүргэлтийн хаяг
                        </span>
                        <p className="font-semibold text-stone-800 flex items-start gap-1">
                          <MapPin className="w-3.5 h-3.5 text-stone-400 shrink-0 mt-0.5" />
                          <span>{order.district}, {order.address}</span>
                        </p>
                        {order.notes && (
                          <p className="text-stone-500 italic bg-amber-50 p-1.5 rounded text-[11px] border border-amber-100">
                            Тэмдэглэл: {order.notes}
                          </p>
                        )}
                      </div>

                      {/* Payment details */}
                      <div className="space-y-1 md:text-right">
                        <span className="text-stone-400 font-bold uppercase tracking-wider text-[10px] block">
                          Төлбөрийн хэлбэр
                        </span>
                        <p className="font-bold text-stone-800 uppercase">
                          {order.paymentMethod === 'qpay' ? 'QPay QR код' : order.paymentMethod === 'bank' ? 'Хаан банк дансаар' : 'Хүлээн авахдаа (COD)'}
                        </p>
                        <p className="text-sm font-black text-rose-600">
                          Нийт: {formatMNT(order.total)}
                        </p>
                      </div>
                    </div>

                    {/* Ordered Items Accordion / Summary */}
                    <div className="bg-stone-50 rounded-xl p-3 border border-stone-200/80 space-y-2">
                      <span className="text-[11px] font-bold text-stone-700 block">
                        Захиалсан бараанууд ({order.items.reduce((sum, i) => sum + i.quantity, 0)} ширхэг):
                      </span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex items-center gap-2.5 bg-white p-2 rounded-lg border border-stone-200/60">
                            <img
                              src={item.image}
                              alt={item.name}
                              className="w-10 h-10 object-cover rounded-md border border-stone-200 shrink-0"
                            />
                            <div className="text-xs truncate flex-1">
                              <p className="font-bold text-stone-900 truncate">{item.name}</p>
                              <p className="text-[11px] text-stone-500">
                                {formatMNT(item.price)} x <strong className="text-stone-800">{item.quantity}</strong> = {formatMNT(item.price * item.quantity)}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}

              {filteredOrders.length === 0 && (
                <div className="text-center py-12 bg-white rounded-2xl border border-stone-200">
                  <ShoppingBag className="w-12 h-12 text-stone-300 mx-auto mb-2" />
                  <p className="font-bold text-stone-700 text-sm">Одоогоор захиалга байхгүй байна</p>
                  <p className="text-xs text-stone-400 mt-1">Хэрэглэгч вэбээс худалдан авалт хийхэд энд шууд бүртгэгдэнэ.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= STATS TAB ================= */}
        {activeTab === 'stats' && (
          <div className="space-y-6">
            {/* Stat metric cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Бараа
                </span>
                <span className="text-2xl sm:text-3xl font-black text-stone-900">{totalProducts}</span>
                <p className="text-[11px] text-emerald-600 font-medium">Бүртгэлтэй нийт нэр төрөл</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Бэлэн байгаа
                </span>
                <span className="text-2xl sm:text-3xl font-black text-emerald-600">{inStockCount}</span>
                <p className="text-[11px] text-stone-500 font-medium">Худалдаанд идэвхтэй</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Захиалга
                </span>
                <span className="text-2xl sm:text-3xl font-black text-stone-900">{totalOrders}</span>
                <p className="text-[11px] text-amber-600 font-medium">{newOrdersCount} шинэ захиалга хүлээгдэж байна</p>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-1">
                <span className="text-xs font-bold text-stone-400 uppercase tracking-wider block">
                  Нийт Орлого
                </span>
                <span className="text-xl sm:text-2xl font-black text-rose-600">{formatMNT(totalRevenue)}</span>
                <p className="text-[11px] text-stone-500 font-medium">Бүртгэгдсэн худалдан авалт</p>
              </div>
            </div>

            {/* Origin & Category breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <h4 className="font-bold text-stone-900 text-sm">Гарал үүслийн харьцаа</h4>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🇰🇷</span>
                      <span>БНСУ (Солонгос)</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      {products.filter(p => p.origin === 'KR').length} бараа
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-rose-500 h-2 rounded-full"
                      style={{ width: `${(products.filter(p => p.origin === 'KR').length / totalProducts) * 100}%` }}
                    />
                  </div>

                  <div className="flex justify-between items-center pt-2">
                    <span className="flex items-center gap-1.5 font-medium">
                      <span>🇺🇸</span>
                      <span>АНУ (Америк)</span>
                    </span>
                    <span className="font-bold text-stone-900">
                      {products.filter(p => p.origin === 'US').length} бараа
                    </span>
                  </div>
                  <div className="w-full bg-stone-100 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full"
                      style={{ width: `${(products.filter(p => p.origin === 'US').length / totalProducts) * 100}%` }}
                    />
                  </div>
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-stone-200 shadow-xs space-y-3">
                <h4 className="font-bold text-stone-900 text-sm">Ангиллаарх барааны тоо</h4>
                <div className="space-y-1.5 text-xs max-h-48 overflow-y-auto pr-1">
                  {CATEGORIES.map(cat => {
                    const count = products.filter(p => p.category === cat.id).length;
                    return (
                      <div key={cat.id} className="flex items-center justify-between py-1 border-b border-stone-100">
                        <span className="text-stone-600">{cat.name}</span>
                        <span className="font-bold text-stone-900 bg-stone-100 px-2 py-0.5 rounded">
                          {count}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= SETTINGS TAB ================= */}
        {activeTab === 'settings' && (
          <div className="max-w-2xl space-y-6">
            {/* PIN Change Section */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-stone-100 flex items-center justify-center text-stone-800">
                  <KeyRound className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Админ ПИН код солих</h4>
                  <p className="text-xs text-stone-500">Админ цонх руу орох 4 оронтой нууц кодоо шинэчлэх</p>
                </div>
              </div>

              {pinChangeMsg && (
                <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-xl text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>{pinChangeMsg}</span>
                </div>
              )}

              <form onSubmit={handleSavePin} className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-700 mb-1">
                    Шинэ ПИН код (Хамгийн багадаа 4 оронтой)
                  </label>
                  <input
                    type="password"
                    placeholder="Жишээ: 5678"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    className="w-full px-3.5 py-2 text-xs border border-stone-300 rounded-xl focus:outline-none focus:border-rose-500 font-mono tracking-widest"
                  />
                </div>
                <button
                  type="submit"
                  className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-bold rounded-xl cursor-pointer"
                >
                  ПИН код хадгалах
                </button>
              </form>
            </div>

            {/* Reset to default catalog */}
            <div className="bg-white p-6 rounded-2xl border border-stone-200 shadow-xs space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                  <RotateCcw className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-stone-900 text-sm">Каталогийг анхны хэвэнд нь оруулах</h4>
                  <p className="text-xs text-stone-500">Хэрэв өгөгдлөө алдаатай оруулсан бол анхдагч 24 барааг буцааж сэргээнэ</p>
                </div>
              </div>

              {!showResetConfirm ? (
                <button
                  onClick={() => setShowResetConfirm(true)}
                  className="px-4 py-2 border border-rose-300 text-rose-600 hover:bg-rose-50 text-xs font-bold rounded-xl cursor-pointer"
                >
                  Анхны каталогийг сэргээх
                </button>
              ) : (
                <div className="p-4 bg-rose-50 rounded-xl border border-rose-200 space-y-3 text-xs text-rose-900">
                  <p className="font-bold">Та өөрийн нэмсэн болон өөрчилсөн бараануудыг устгаад анхны төлөвт нь оруулахдаа итгэлтэй байна уу?</p>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        onResetProducts();
                        setShowResetConfirm(false);
                      }}
                      className="px-3.5 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg cursor-pointer"
                    >
                      Тийм, сэргээ
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3.5 py-1.5 bg-white border border-stone-300 text-stone-700 font-bold rounded-lg cursor-pointer"
                    >
                      Болих
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Product Form Modal (Add / Edit) */}
      <ProductFormModal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        productToEdit={editingProduct}
        onSave={onSaveProduct}
      />

      {/* Delete Confirmation Modal */}
      {deletingProductId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-stone-200 space-y-4 text-center">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <h4 className="font-bold text-stone-900 text-base">Энэ барааг устгах уу?</h4>
            <p className="text-xs text-stone-500">
              Барааг устгаснаар дэлгүүрийн жагсаалтаас бүрмөсөн хасагдана.
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <button
                onClick={() => setDeletingProductId(null)}
                className="px-4 py-2 text-xs font-bold text-stone-600 hover:text-stone-900 cursor-pointer"
              >
                Болих
              </button>
              <button
                onClick={() => confirmDelete(deletingProductId)}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl shadow-md cursor-pointer"
              >
                Устгах
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
