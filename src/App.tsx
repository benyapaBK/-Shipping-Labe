/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Plus, 
  Trash2, 
  Printer, 
  FileDown, 
  History, 
  Settings, 
  Info, 
  LogOut, 
  User, 
  FileText, 
  Upload, 
  CheckCircle2, 
  AlertCircle, 
  ChevronRight,
  PackageCheck,
  Sparkles,
  Truck,
  Zap,
  LayoutGrid,
  List,
  X,
  Search,
  Download,
  Store,
  Package
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import Papa from 'papaparse';
import * as XLSX from 'xlsx';
import { useDropzone } from 'react-dropzone';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { GoogleGenAI } from "@google/genai";

// --- AI Service ---
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const parseAddressWithAI = async (text: string) => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following Thai address text into a structured JSON array of recipients. 
      IMPORTANT: 
      1. Correct common misspellings or missing prefixes (e.g., add 'ต.' if missing before a sub-district name).
      2. Perform data quality checks:
         - Check if the phone number is incomplete (Thai mobile numbers should be 10 digits starting with 0, or 9 digits for old landlines).
         - Check if the address is missing a sub-district (ตำบล/แขวง), district (อำเภอ/เขต), or province (จังหวัด).
         - Check if the zip code matches the address if possible.
      Format: [{ "name": "...", "phone": "...", "address": "...", "zipCode": "...", "errors": ["error message 1", ...] }]
      Text: "${text}"`,
      config: {
        responseMimeType: "application/json"
      }
    });
    return JSON.parse(response.text || '[]');
  } catch (err) {
    console.error("AI Parsing Error:", err);
    return null;
  }
};

// Firebase Imports
import { 
  auth, 
  db, 
  googleProvider, 
  signInWithPopup, 
  signOut, 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  orderBy, 
  serverTimestamp 
} from './firebase';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';

// Utility for Tailwind classes
function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// --- Types ---
interface Item {
  id: string;
  name: string;
  price: number;
  stock: number;
  quantity: number;
}

interface Recipient {
  id: string;
  name: string;
  phone: string;
  address: string;
  zipCode: string;
  items: Item[];
  isValid: boolean;
  errors: string[];
}

interface HistoryRecord extends Recipient {
  createdAt: any;
  labelSize: string;
}

// --- Components ---

const Button = ({ 
  children, 
  className, 
  variant = 'primary', 
  size = 'md', 
  ...props 
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { 
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'luxury';
  size?: 'sm' | 'md' | 'lg';
}) => {
  const variants = {
    primary: 'gradient-primary text-white dark:text-black hover:opacity-90 shadow-luxury dark:shadow-none',
    secondary: 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700',
    outline: 'border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800',
    danger: 'bg-rose-500 text-white hover:bg-rose-600 shadow-sm',
    ghost: 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400',
    luxury: 'bg-slate-900 dark:bg-amber-400 text-white dark:text-slate-900 hover:bg-black dark:hover:bg-amber-500 shadow-luxury dark:shadow-none',
  };
  
  const sizes = {
    sm: 'px-3 py-1.5 text-xs font-semibold',
    md: 'px-5 py-2.5 text-sm font-semibold',
    lg: 'px-8 py-4 text-base font-bold tracking-tight',
  };

  return (
    <button 
      className={cn(
        'rounded-2xl transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:pointer-events-none cursor-pointer', 
        variants[variant], 
        sizes[size],
        className
      )} 
      {...props}
    >
      {children}
    </button>
  );
};

const Card = ({ children, className, ...props }: { children: React.ReactNode; className?: string; [key: string]: any }) => (
  <div className={cn('bg-white dark:bg-black rounded-3xl shadow-luxury dark:shadow-none border border-slate-100 dark:border-white/10 p-8', className)} {...props}>
    {children}
  </div>
);

const LabelPreview = ({ recipient, size, shopName }: { recipient: Recipient; size: '100x75' | '100x150'; shopName?: string }) => {
  const isLarge = size === '100x150';
  const isSmall = size === '100x75';
  
  return (
    <div className={cn(
      'bg-white border-2 border-slate-900 mx-auto overflow-hidden flex flex-col shadow-2xl',
      isSmall ? 'w-[300px] h-[225px] p-3' : 'w-[300px] h-[450px] p-5'
    )}>
      {/* Sender Info (Top for Large, Bottom for Small) */}
      {shopName && isLarge && (
        <div className="mb-2 pb-2 border-b border-slate-200 flex justify-between items-center">
          <div>
            <p className="text-[7px] font-black uppercase tracking-[0.2em] text-slate-400">Sender / ผู้ส่ง</p>
            <p className="text-[10px] font-bold text-slate-700">{shopName}</p>
          </div>
          <div className="w-6 h-6 bg-slate-100 rounded flex items-center justify-center">
            <Package size={12} className="text-slate-400" />
          </div>
        </div>
      )}

      <div className={cn(
        "border-b-2 border-slate-900 flex justify-between items-start",
        isSmall ? "pb-2 mb-2" : "pb-3 mb-3"
      )}>
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Recipient</p>
          <h3 className={cn(
            "font-extrabold leading-tight text-slate-900",
            isSmall ? "text-lg" : "text-lg"
          )}>{recipient.name}</h3>
        </div>
        <div className="text-right">
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Contact</p>
          <p className={cn(
            "font-mono font-bold text-slate-900",
            isSmall ? "text-xs" : "text-xs"
          )}>{recipient.phone}</p>
        </div>
      </div>
      
      <div className="flex-grow">
        <p className={cn(
          "font-black uppercase tracking-[0.2em] text-slate-400",
          isSmall ? "text-[8px] mb-1" : "text-[8px] mb-1"
        )}>Shipping Address</p>
        <p className={cn(
          "font-medium leading-relaxed text-slate-800",
          isSmall ? "text-[11px] line-clamp-3" : "text-[13px]"
        )}>{recipient.address}</p>
        <div className={cn(
          "inline-block bg-slate-900 text-white rounded-md",
          isSmall ? "mt-2 px-2 py-0.5" : "mt-3 px-3 py-1"
        )}>
          <p className={cn(
            "font-black tracking-[0.3em]",
            isSmall ? "text-xl" : "text-xl"
          )}>{recipient.zipCode}</p>
        </div>
      </div>

      {isLarge && (
        <div className="mt-3 pt-3 border-t-2 border-dashed border-slate-200">
          <p className="text-[8px] font-black uppercase tracking-[0.2em] text-slate-400 mb-2">Order Manifest</p>
          <div className="space-y-1.5 max-h-[120px] overflow-hidden">
            {recipient.items.map((item, idx) => (
              <div key={idx} className="flex justify-between text-[11px] font-bold text-slate-700">
                <span className="flex items-center gap-2">
                  <div className="w-1 h-1 rounded-full bg-indigo-500"></div>
                  {item.name}
                </span>
                <span className="bg-slate-100 px-1.5 py-0.5 rounded text-[9px]">x{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className={cn(
        "mt-auto flex justify-between items-end",
        isSmall ? "pt-2" : "pt-4"
      )}>
        <div className={cn(
          "bg-slate-50 flex items-center justify-center border border-slate-100 rounded-lg",
          isSmall ? "w-10 h-10" : "w-14 h-14"
        )}>
          <PackageCheck size={isSmall ? 18 : 24} className="text-slate-200" />
        </div>
        <div className="text-right">
          {shopName && isSmall && (
            <div className="mb-0.5">
              <p className="text-[6px] font-black uppercase tracking-[0.2em] text-slate-400">Sender</p>
              <p className="text-[9px] font-bold text-slate-700 leading-none mb-1">{shopName}</p>
            </div>
          )}
          <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ShipLux Premium v1.0</p>
        </div>
      </div>
    </div>
  );
};

export default function App() {
  // --- State ---
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shipLuxDarkMode') === 'true';
    }
    return false;
  });
  const [activeTab, setActiveTab] = useState<'preview' | 'history' | 'settings'>('preview');
  const [labelSize, setLabelSize] = useState<'100x75' | '100x150'>('100x75');
  
  // Dark Mode Effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('shipLuxDarkMode', darkMode.toString());
  }, [darkMode]);

  // Input States
  const [items, setItems] = useState<Item[]>([]);
  const [newItem, setNewItem] = useState({ name: '', price: 0, stock: 0, quantity: 1 });
  const [rawAddressInput, setRawAddressInput] = useState('');
  const [queue, setQueue] = useState<Recipient[]>([]);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [selectedQueueIds, setSelectedQueueIds] = useState<Set<string>>(new Set());
  const [shopName, setShopName] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('shipLuxShopName') || '';
    }
    return '';
  });

  useEffect(() => {
    localStorage.setItem('shipLuxShopName', shopName);
  }, [shopName]);
  
  // UI States
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // --- Firebase Auth ---
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return () => unsubscribe();
  }, []);

  // --- Fetch History ---
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }

    const q = query(
      collection(db, 'shipping_labels'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const records = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as HistoryRecord[];
      setHistory(records);
    }, (err) => {
      console.error("Firestore Error:", err);
    });

    return () => unsubscribe();
  }, [user]);

  // --- Logic ---

  const handleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      console.error("Login Error:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (err) {
      console.error("Logout Error:", err);
    }
  };

  const addItem = () => {
    if (!newItem.name) return;
    setItems([...items, { ...newItem, id: Math.random().toString(36).substr(2, 9) }]);
    setNewItem({ name: '', price: 0, stock: 0, quantity: 1 });
  };

  const removeItem = (id: string) => {
    setItems(items.filter(i => i.id !== id));
  };

  const handleAIParse = async () => {
    if (!rawAddressInput.trim()) return;
    setIsProcessing(true);
    const results = await parseAddressWithAI(rawAddressInput);
    if (results && Array.isArray(results)) {
      const newRecipients = results.map(r => {
        const errors = r.errors || [];
        
        // Manual Validation & Quality Checks
        const phoneDigits = (r.phone || '').replace(/\D/g, '');
        if (phoneDigits.length > 0 && phoneDigits.length < 10) {
          if (!errors.includes('เบอร์โทรศัพท์ไม่ครบ (ควรมี 10 หลัก)')) {
            errors.push('เบอร์โทรศัพท์ไม่ครบ (ควรมี 10 หลัก)');
          }
        }
        
        const addr = r.address || '';
        if (addr && !addr.includes('ต.') && !addr.includes('ตำบล') && !addr.includes('แขวง')) {
          if (!errors.includes('ขาดข้อมูลตำบล/แขวง')) errors.push('ขาดข้อมูลตำบล/แขวง');
        }
        if (addr && !addr.includes('อ.') && !addr.includes('อำเภอ') && !addr.includes('เขต')) {
          if (!errors.includes('ขาดข้อมูลอำเภอ/เขต')) errors.push('ขาดข้อมูลอำเภอ/เขต');
        }
        if (addr && !addr.includes('จ.') && !addr.includes('จังหวัด')) {
          if (!errors.includes('ขาดข้อมูลจังหวัด')) errors.push('ขาดข้อมูลจังหวัด');
        }

        // Stock Check
        items.forEach(item => {
          if (item.quantity > item.stock) {
            if (!errors.includes(`สินค้า ${item.name} สต็อกไม่พอ (มี ${item.stock})`)) {
              errors.push(`สินค้า ${item.name} สต็อกไม่พอ (มี ${item.stock})`);
            }
          }
        });

        return {
          id: Math.random().toString(36).substr(2, 9),
          name: r.name || '',
          phone: r.phone || '',
          address: r.address || '',
          zipCode: r.zipCode || '',
          items: [...items],
          isValid: !!(r.name && r.phone && r.address && r.zipCode) && errors.length === 0,
          errors: errors
        };
      });
      setQueue([...queue, ...newRecipients]);
      setRawAddressInput('');
    } else {
      setError("AI ไม่สามารถประมวลผลข้อมูลได้ กรุณาลองใหม่อีกครั้ง");
    }
    setIsProcessing(false);
  };

  const onDrop = useCallback((acceptedFiles: File[]) => {
    acceptedFiles.forEach(file => {
      const reader = new FileReader();
      const extension = file.name.split('.').pop()?.toLowerCase();

      reader.onload = (e) => {
        const content = e.target?.result;
        if (!content) return;

        if (extension === 'csv' || extension === 'txt') {
          Papa.parse(content as string, {
            complete: (results) => {
              const parsed = results.data as string[][];
              const newRecipients = parsed.map(row => {
                const name = row[0] || '';
                const phone = row[1] || '';
                const address = row[2] || '';
                const zipCode = row[3] || '';
                
                return {
                  id: Math.random().toString(36).substr(2, 9),
                  name, phone, address, zipCode,
                  items: [...items],
                  isValid: !!(name && phone && address && zipCode),
                  errors: []
                };
              });
              setQueue(prev => [...prev, ...newRecipients]);
            }
          });
        } else if (extension === 'xlsx') {
          const workbook = XLSX.read(content, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const sheet = workbook.Sheets[sheetName];
          const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
          
          const newRecipients = data.slice(1).map(row => ({
            id: Math.random().toString(36).substr(2, 9),
            name: String(row[0] || ''),
            phone: String(row[1] || ''),
            address: String(row[2] || ''),
            zipCode: String(row[3] || ''),
            items: [...items],
            isValid: !!(row[0] && row[1] && row[2] && row[3]),
            errors: []
          }));
          setQueue(prev => [...prev, ...newRecipients]);
        }
      };

      if (extension === 'xlsx') {
        reader.readAsBinaryString(file);
      } else {
        reader.readAsText(file);
      }
    });
  }, [items]);

  // @ts-ignore
  const { getRootProps, getInputProps } = useDropzone({ 
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/csv': ['.csv'],
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx']
    }
  });

  const toggleSelectQueue = (id: string) => {
    const newSelected = new Set(selectedQueueIds);
    if (newSelected.has(id)) newSelected.delete(id);
    else newSelected.add(id);
    setSelectedQueueIds(newSelected);
  };

  const selectAllQueue = () => {
    if (selectedQueueIds.size === queue.length) setSelectedQueueIds(new Set());
    else setSelectedQueueIds(new Set(queue.map(q => q.id)));
  };

  const clearQueue = () => {
    setQueue([]);
    setSelectedQueueIds(new Set());
  };

  const deleteSelectedQueue = () => {
    setQueue(queue.filter(q => !selectedQueueIds.has(q.id)));
    setSelectedQueueIds(new Set());
  };

  const generateLabels = async () => {
    const toProcess = queue.filter(q => q.isValid && (selectedQueueIds.size === 0 || selectedQueueIds.has(q.id)));
    if (toProcess.length === 0) return;

    setIsProcessing(true);
    
    try {
      // Save to Firebase if logged in
      if (user) {
        for (const recipient of toProcess) {
          await addDoc(collection(db, 'shipping_labels'), {
            recipientName: recipient.name,
            phone: recipient.phone,
            address: recipient.address,
            zipCode: recipient.zipCode,
            items: recipient.items.map(i => ({ name: i.name, quantity: i.quantity })),
            labelSize,
            userId: user.uid,
            createdAt: serverTimestamp()
          });
        }
      }
      
      // Trigger Print
      window.print();
      
      // Remove processed from queue
      setQueue(queue.filter(q => !toProcess.find(p => p.id === q.id)));
      setSelectedQueueIds(new Set());
    } catch (err) {
      console.error("Processing Error:", err);
      setError("เกิดข้อผิดพลาดในการบันทึกข้อมูล");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportPDF = async () => {
    const toProcess = queue.filter(q => q.isValid && (selectedQueueIds.size === 0 || selectedQueueIds.has(q.id)));
    if (toProcess.length === 0) return;

    setIsProcessing(true);
    try {
      const printArea = document.getElementById('print-area');
      if (!printArea) return;

      // Temporarily show print area for capture
      printArea.classList.remove('hidden');
      printArea.style.position = 'fixed';
      printArea.style.top = '-9999px';
      printArea.style.left = '0';
      printArea.style.width = '100mm';
      printArea.style.display = 'block';

      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: labelSize === '100x75' ? [100, 75] : [100, 150]
      });

      const labels = printArea.children;
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i] as HTMLElement;
        const canvas = await html2canvas(label, {
          scale: 3, // Higher resolution
          useCORS: true,
          logging: false,
          backgroundColor: '#ffffff'
        });

        const imgData = canvas.toDataURL('image/png');
        if (i > 0) doc.addPage();
        
        const pdfWidth = doc.internal.pageSize.getWidth();
        const pdfHeight = doc.internal.pageSize.getHeight();
        doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      }

      doc.save(`ShipLux_Labels_${new Date().getTime()}.pdf`);
      
      // Restore print area
      printArea.classList.add('hidden');
      printArea.style.position = '';
      printArea.style.top = '';
      printArea.style.left = '';
      printArea.style.width = '';
      printArea.style.display = '';
    } catch (err) {
      console.error("PDF Export Error:", err);
      setError("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportSinglePDF = async (recipient: Recipient) => {
    setIsProcessing(true);
    try {
      // Create a temporary container for the single label
      const tempDiv = document.createElement('div');
      tempDiv.style.position = 'fixed';
      tempDiv.style.top = '-9999px';
      tempDiv.style.left = '0';
      tempDiv.style.width = '100mm';
      document.body.appendChild(tempDiv);

      // We need to render the label exactly as it appears in print
      const labelHtml = `
        <div class="${labelSize === '100x75' ? 'label-100x75 relative' : 'label-100x150'}" style="width: 100mm; height: ${labelSize === '100x75' ? '75mm' : '150mm'}; background: white; padding: 5mm; border: 1px solid black; box-sizing: border-box; display: flex; flex-direction: column; font-family: sans-serif;">
          ${shopName && labelSize === '100x150' ? `
            <div style="margin-bottom: 1mm; padding-bottom: 1mm; border-bottom: 1px solid #ccc; display: flex; justify-content: space-between; align-items: center;">
              <div>
                <p style="font-size: 7px; font-weight: bold; text-transform: uppercase; margin: 0;">Sender / ผู้ส่ง</p>
                <p style="font-size: 10px; font-weight: bold; margin: 0;">${shopName}</p>
              </div>
            </div>
          ` : ''}
          <div style="border-bottom: 2px solid black; display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: ${labelSize === '100x75' ? '1mm' : '2mm'}; margin-bottom: ${labelSize === '100x75' ? '1mm' : '2mm'};">
            <div>
              <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin: 0;">Recipient / ผู้รับ</p>
              <h3 style="font-size: 18px; font-weight: bold; margin: 0; line-height: 1.2;">${recipient.name}</h3>
            </div>
            <div style="text-align: right;">
              <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin: 0;">TEL / โทร</p>
              <p style="font-size: 16px; font-weight: bold; margin: 0;">${recipient.phone}</p>
            </div>
          </div>
          <div style="flex-grow: 1;">
            <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin: 0; margin-bottom: 1mm;">Address / ที่อยู่</p>
            <p style="font-size: ${labelSize === '100x75' ? '12px' : '13px'}; line-height: 1.5; margin: 0;">${recipient.address}</p>
            <p style="font-size: 24px; font-weight: 900; letter-spacing: 2px; margin: 0; margin-top: ${labelSize === '100x75' ? '2mm' : '3mm'};">${recipient.zipCode}</p>
          </div>
          ${labelSize === '100x150' ? `
            <div style="margin-top: 3mm; padding-top: 3mm; border-top: 2px dashed #ccc;">
              <p style="font-size: 9px; font-weight: bold; text-transform: uppercase; margin: 0; margin-bottom: 2mm;">Order Details</p>
              <div style="display: flex; flex-direction: column; gap: 1mm;">
                ${recipient.items.map(item => `
                  <div style="display: flex; justify-content: space-between; font-size: 11px;">
                    <span>${item.name}</span>
                    <span style="font-weight: bold;">x${item.quantity}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          ` : ''}
          <div style="margin-top: auto; display: flex; justify-content: space-between; align-items: flex-end; padding-top: ${labelSize === '100x75' ? '1mm' : '2mm'};">
            <div style="width: ${labelSize === '100x75' ? '12mm' : '16mm'}; height: ${labelSize === '100x75' ? '12mm' : '16mm'}; background: #f3f4f6; border: 1px solid black; display: flex; align-items: center; justify-content: center;">
              <span style="font-size: 8px;">QR CODE</span>
            </div>
            <div style="text-align: right;">
              ${shopName && labelSize === '100x75' ? `
                <div style="margin-bottom: 0.5mm;">
                  <p style="font-size: 6px; font-weight: bold; text-transform: uppercase; margin: 0;">Sender</p>
                  <p style="font-size: 9px; font-weight: bold; margin: 0; line-height: 1;">${shopName}</p>
                </div>
              ` : ''}
              <p style="font-size: 8px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; margin: 0;">ShipLux Premium v1.0</p>
            </div>
          </div>
        </div>
      `;

      tempDiv.innerHTML = labelHtml;

      const canvas = await html2canvas(tempDiv.firstElementChild as HTMLElement, {
        scale: 3,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });

      const imgData = canvas.toDataURL('image/png');
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: labelSize === '100x75' ? [100, 75] : [100, 150]
      });

      doc.addImage(imgData, 'PNG', 0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight());
      doc.save(`ShipLux_Label_${recipient.name.replace(/\s+/g, '_')}.pdf`);

      document.body.removeChild(tempDiv);
    } catch (err) {
      console.error("Single PDF Export Error:", err);
      setError("เกิดข้อผิดพลาดในการสร้าง PDF");
    } finally {
      setIsProcessing(false);
    }
  };

  const exportJSON = () => {
    const data = JSON.stringify(queue, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipping-queue-${Date.now()}.json`;
    a.click();
  };

  // --- Render ---

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="w-16 h-16 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-slate-500 font-medium">กำลังโหลดระบบ...</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="glass dark:bg-black/80 border-b border-slate-200 dark:border-white/10 sticky top-0 z-40 no-print">
        <div className="max-w-[1600px] mx-auto px-8 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="w-14 h-14 gradient-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-indigo-200 dark:shadow-amber-900/20 rotate-3 transition-transform hover:rotate-0">
                <PackageCheck size={32} />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-amber-400 rounded-full flex items-center justify-center text-white shadow-sm animate-pulse">
                <Sparkles size={14} />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white leading-none tracking-tight">
                Ship<span className="text-indigo-600 dark:text-amber-400">Lux</span>
              </h1>
              <p className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-1 uppercase tracking-widest">Premium Label Solutions</p>
            </div>
          </div>

            <div className="flex items-center gap-6">
              <Button variant="ghost" size="sm" onClick={() => setShowUsageModal(true)} className="font-bold">
                <Info size={18} className="text-indigo-600 dark:text-amber-400" />
                Guide
              </Button>
              
              <div className="h-10 w-px bg-slate-200 dark:bg-slate-800"></div>

              {user ? (
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{user.displayName}</p>
                    <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{user.email}</p>
                  </div>
                  <div className="relative group">
                    <img src={user.photoURL || ''} alt="Avatar" className="w-12 h-12 rounded-2xl border-2 border-white dark:border-slate-800 shadow-md transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 rounded-2xl ring-2 ring-indigo-500/20 dark:ring-amber-400/20 group-hover:ring-indigo-500/40 dark:group-hover:ring-amber-400/40 transition-all"></div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={handleLogout} className="text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl">
                    <LogOut size={18} />
                  </Button>
                </div>
              ) : (
                <Button onClick={handleLogin} variant="outline" size="sm" className="bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
                  <User size={18} className="text-indigo-600 dark:text-amber-400" />
                  Sign In
                </Button>
              )}
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow max-w-[1600px] mx-auto w-full p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 no-print">
        
        {/* Left Panel: Inputs */}
        <div className="lg:col-span-5 space-y-6">
          
          {/* Section: Items */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-amber-400">
                  <LayoutGrid size={22} />
                </div>
                สินค้า & สต็อก
              </h2>
              <span className="text-[10px] font-black px-3 py-1 bg-indigo-50 dark:bg-amber-900/20 text-indigo-700 dark:text-amber-400 rounded-full uppercase tracking-wider">
                {items.length} Items
              </span>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">ชื่อสินค้า</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-amber-400/10 focus:border-indigo-500 dark:focus:border-amber-400 outline-none transition-all"
                  placeholder="เช่น เสื้อยืดสีขาว"
                  value={newItem.name}
                  onChange={e => setNewItem({...newItem, name: e.target.value})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">ราคา</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-amber-400/10 focus:border-indigo-500 dark:focus:border-amber-400 outline-none transition-all"
                  value={newItem.price}
                  onChange={e => setNewItem({...newItem, price: Number(e.target.value)})}
                />
              </div>
              <div>
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">สต็อก</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-amber-400/10 focus:border-indigo-500 dark:focus:border-amber-400 outline-none transition-all"
                  value={newItem.stock}
                  onChange={e => setNewItem({...newItem, stock: Number(e.target.value)})}
                />
              </div>
              <div className="col-span-2">
                <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">จำนวนที่สั่ง</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-amber-400/10 focus:border-indigo-500 dark:focus:border-amber-400 outline-none transition-all"
                  value={newItem.quantity}
                  onChange={e => setNewItem({...newItem, quantity: Number(e.target.value)})}
                />
              </div>
            </div>
            
            <Button className="w-full" onClick={addItem}>
              <Plus size={18} />
              เพิ่มสินค้า
            </Button>

            {items.length > 0 && (
              <div className="mt-4 space-y-2 max-h-40 overflow-y-auto pr-2">
                {items.map(item => (
                  <div key={item.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                    <div>
                      <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{item.name}</p>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{item.price} บาท | สต็อก: {item.stock} | x{item.quantity}</p>
                    </div>
                    <button onClick={() => removeItem(item.id)} className="text-slate-400 dark:text-amber-400/50 hover:text-rose-500 dark:hover:text-amber-400 transition-colors">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* Section: Recipients */}
          <Card>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-extrabold flex items-center gap-3 text-slate-900 dark:text-slate-100">
                <div className="w-10 h-10 bg-indigo-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-amber-400">
                  <User size={22} />
                </div>
                ข้อมูลผู้รับ
              </h2>
            </div>

            <div className="mb-6">
              <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-2 block tracking-widest">
                วางข้อมูลผู้รับ (ชื่อ | เบอร์ | ที่อยู่ | รหัสไปรษณีย์)
              </label>
              <textarea 
                className="w-full h-40 px-5 py-4 rounded-2xl border border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/50 text-slate-900 dark:text-slate-100 focus:bg-white dark:focus:bg-slate-800 focus:ring-4 focus:ring-indigo-500/10 dark:focus:ring-amber-400/10 focus:border-indigo-500 dark:focus:border-amber-400 outline-none transition-all resize-none text-sm leading-relaxed"
                placeholder="สมชาย เข็มกลัด | 0812345678 | 123 ม.4 ต.ในเมือง อ.เมือง จ.ขอนแก่น 40000"
                value={rawAddressInput}
                onChange={e => setRawAddressInput(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4 mb-6">
              <Button variant="outline" size="sm" onClick={handleAIParse} disabled={isProcessing} className="bg-indigo-50/50 dark:bg-amber-900/10 border-indigo-100 dark:border-amber-900/30 text-indigo-600 dark:text-amber-400 hover:bg-indigo-100 dark:hover:bg-amber-900/20">
                <Zap size={16} />
                AI Smart Parse
              </Button>
              <div {...getRootProps()} className="w-full">
                <input {...getInputProps()} />
                <Button variant="outline" size="sm" className="w-full bg-slate-50/50 dark:bg-amber-900/10 border-slate-200 dark:border-amber-900/30 text-slate-700 dark:text-amber-400 hover:bg-slate-100 dark:hover:bg-amber-900/20">
                  <Upload size={16} />
                  Import File
                </Button>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="ghost" size="sm" className="flex-1 dark:text-amber-400/70 dark:hover:text-amber-400 dark:hover:bg-amber-900/20" onClick={() => setQueue([])}>
                <Trash2 size={16} />
                ลบทั้งหมด
              </Button>
              <Button variant="ghost" size="sm" className="flex-1 text-emerald-600 dark:text-amber-400 dark:hover:bg-amber-900/20" onClick={handleAIParse}>
                <History size={16} />
                ดึงแถวข้อมูล (AI)
              </Button>
            </div>
          </Card>

          <div className="flex gap-3">
            <Button 
              size="lg" 
              className="flex-1 py-6 text-xl shadow-lg shadow-emerald-200" 
              onClick={generateLabels}
              disabled={isProcessing || queue.length === 0}
            >
              {isProcessing ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  <Printer size={24} />
                  พิมพ์ Label ({selectedQueueIds.size > 0 ? selectedQueueIds.size : queue.length})
                </>
              )}
            </Button>
            <Button 
              size="lg" 
              variant="secondary"
              className="px-6 py-6 shadow-lg" 
              onClick={exportPDF}
              disabled={isProcessing || queue.length === 0}
            >
              <FileDown size={24} />
            </Button>
          </div>
        </div>

        {/* Right Panel: Preview & Queue */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Tabs */}
          <div className="flex bg-slate-100 dark:bg-slate-900 p-1.5 rounded-2xl border border-slate-200 dark:border-white/10 shadow-inner">
            <button 
              onClick={() => setActiveTab('preview')}
              className={cn(
                'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                activeTab === 'preview' ? 'bg-white dark:bg-black text-indigo-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              <List size={16} />
              Queue
            </button>
            <button 
              onClick={() => setActiveTab('history')}
              className={cn(
                'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                activeTab === 'history' ? 'bg-white dark:bg-black text-indigo-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              <History size={16} />
              History
            </button>
            <button 
              onClick={() => setActiveTab('settings')}
              className={cn(
                'flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2',
                activeTab === 'settings' ? 'bg-white dark:bg-black text-indigo-600 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
              )}
            >
              <Settings size={16} />
              Settings
            </button>
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'preview' && (
              <motion.div 
                key="preview"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6"
              >
                {/* Size Toggle */}
                <Card className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-600 dark:text-slate-400">Label Size:</span>
                    <div className="flex bg-slate-100 dark:bg-slate-900 p-1 rounded-xl border border-transparent dark:border-white/10">
                      <button 
                        onClick={() => setLabelSize('100x75')}
                        className={cn(
                          'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          labelSize === '100x75' ? 'bg-white dark:bg-black text-indigo-600 dark:text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        )}
                      >
                        100x75 mm
                      </button>
                      <button 
                        onClick={() => setLabelSize('100x150')}
                        className={cn(
                          'px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all',
                          labelSize === '100x150' ? 'bg-white dark:bg-black text-indigo-600 dark:text-amber-400 shadow-sm' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                        )}
                      >
                        100x150 mm
                      </button>
                    </div>
                  </div>
                </Card>

                {/* Preview Area */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Card className="md:col-span-1 flex flex-col items-center justify-center bg-slate-50 dark:bg-slate-900/50 border-dashed border-2 border-slate-200 dark:border-white/10">
                    <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 mb-6 uppercase tracking-[0.3em]">Live Preview</p>
                    {queue.length > 0 ? (
                    <div className="flex flex-col items-center gap-4">
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.4 }}
                      >
                        <LabelPreview recipient={queue[0]} size={labelSize} shopName={shopName} />
                      </motion.div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-xl gap-2"
                        onClick={() => exportSinglePDF(queue[0])}
                        disabled={isProcessing}
                      >
                        <FileDown size={14} />
                        Export PDF (หน้านี้)
                      </Button>
                    </div>
                    ) : (
                      <div className="text-center p-12">
                        <div className="w-20 h-20 bg-slate-100 rounded-3xl flex items-center justify-center text-slate-200 mx-auto mb-6">
                          <PackageCheck size={40} />
                        </div>
                        <p className="text-sm font-bold text-slate-400">ยังไม่มีข้อมูลในคิว</p>
                      </div>
                    )}
                  </Card>

                  <Card className="md:col-span-1 flex flex-col justify-center p-8">
                    <h4 className="text-sm font-black text-slate-900 dark:text-white mb-6 uppercase tracking-widest">Quick Actions</h4>
                    
                    <div className="space-y-3">
                      <Button variant="outline" size="sm" className="w-full justify-start rounded-xl" onClick={selectAllQueue}>
                        <CheckCircle2 size={16} className="text-indigo-500 dark:text-amber-400" />
                        {selectedQueueIds.size === queue.length ? 'ยกเลิกเลือกทั้งหมด' : 'เลือกทั้งหมด'}
                      </Button>
                      <Button variant="outline" size="sm" className="w-full justify-start text-rose-500 rounded-xl hover:bg-rose-50 dark:hover:bg-rose-900/20 border-rose-100 dark:border-rose-900/30" onClick={clearQueue}>
                        <Trash2 size={16} />
                        ล้างคิวทั้งหมด
                      </Button>
                      <div className="h-px bg-slate-100 dark:bg-white/10 my-2"></div>
                      <Button variant="secondary" size="sm" className="w-full justify-start rounded-xl" onClick={exportPDF}>
                        <FileDown size={16} className="text-indigo-500 dark:text-amber-400" />
                        Export PDF
                      </Button>
                      <Button variant="secondary" size="sm" className="w-full justify-start rounded-xl" onClick={exportJSON}>
                        <Download size={16} className="text-indigo-500 dark:text-amber-400" />
                        Export JSON
                      </Button>
                    </div>
                  </Card>
                </div>

                {/* Queue Table */}
                <Card className="p-0 overflow-hidden">
                  <div className="p-6 border-b border-slate-100 dark:border-white/10 bg-slate-50/30 dark:bg-white/5 flex items-center justify-between">
                    <h3 className="font-extrabold text-slate-900 dark:text-white">รายการในคิว</h3>
                    <div className="flex gap-3">
                      {selectedQueueIds.size > 0 && (
                        <Button variant="danger" size="sm" onClick={deleteSelectedQueue} className="rounded-xl">
                          ลบที่เลือก ({selectedQueueIds.size})
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase bg-slate-50/50 dark:bg-white/5 tracking-widest">
                        <tr>
                          <th className="px-6 py-4 w-10">
                            <input 
                              type="checkbox" 
                              checked={queue.length > 0 && selectedQueueIds.size === queue.length}
                              onChange={selectAllQueue}
                              className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-indigo-600 dark:text-amber-400 focus:ring-indigo-500 dark:focus:ring-amber-400" 
                            />
                          </th>
                          <th className="px-6 py-4">ผู้รับ</th>
                          <th className="px-6 py-4">เบอร์โทร</th>
                          <th className="px-6 py-4 text-left">ที่อยู่</th>
                          <th className="px-6 py-4">สถานะ</th>
                          <th className="px-6 py-4 text-right">จัดการ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {queue.map(q => (
                          <tr key={q.id} className={cn('hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group', !q.isValid && 'bg-rose-50/20 dark:bg-rose-900/10')}>
                            <td className="px-6 py-4">
                              <input 
                                type="checkbox" 
                                checked={selectedQueueIds.has(q.id)}
                                onChange={() => toggleSelectQueue(q.id)}
                                className="w-4 h-4 rounded border-slate-300 dark:border-white/20 text-indigo-600 dark:text-amber-400 focus:ring-indigo-500 dark:focus:ring-amber-400" 
                              />
                            </td>
                            <td className="px-6 py-4 font-bold text-slate-700 dark:text-slate-200">{q.name || <span className="text-rose-400 italic font-medium">ไม่มีชื่อ</span>}</td>
                            <td className="px-6 py-4 font-mono text-slate-500 dark:text-slate-400">{q.phone}</td>
                            <td className="px-6 py-4 text-xs text-slate-500 dark:text-slate-400 max-w-[200px] truncate">{q.address}</td>
                            <td className="px-6 py-4">
                              {q.isValid ? (
                                <span className="flex items-center gap-1.5 text-indigo-600 dark:text-amber-400 text-[10px] font-black uppercase tracking-wider">
                                  <CheckCircle2 size={12} /> Ready
                                </span>
                              ) : (
                                <div className="flex flex-col gap-1">
                                  <span className="flex items-center gap-1.5 text-rose-500 text-[10px] font-black uppercase tracking-wider group relative cursor-help">
                                    <AlertCircle size={12} /> Incomplete
                                    <div className="absolute bottom-full left-0 mb-3 hidden group-hover:block bg-slate-900 dark:bg-black text-white p-4 rounded-2xl text-[10px] w-56 z-50 shadow-2xl border border-white/10">
                                      <p className="font-black mb-2 border-b border-white/10 pb-2 uppercase tracking-widest text-rose-400">Validation Errors:</p>
                                      <ul className="list-disc pl-4 space-y-1.5">
                                        {q.errors.map((err, i) => <li key={i} className="leading-relaxed">{err}</li>)}
                                      </ul>
                                    </div>
                                  </span>
                                </div>
                              )}
                            </td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => setQueue(queue.filter(item => item.id !== q.id))}
                                className="text-slate-300 dark:text-slate-600 hover:text-rose-500 dark:hover:text-rose-400 transition-colors p-2 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-lg"
                              >
                                <X size={18} />
                              </button>
                            </td>
                          </tr>
                        ))}
                        {queue.length === 0 && (
                          <tr>
                            <td colSpan={6} className="px-6 py-12 text-center text-slate-400 italic">
                              ไม่มีรายการในคิว
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </Card>
              </motion.div>
            )}

            {activeTab === 'history' && (
              <motion.div 
                key="history"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-4"
              >
                {!user ? (
                  <Card className="text-center py-12">
                    <History size={48} className="mx-auto text-slate-200 mb-4" />
                    <h3 className="text-lg font-bold mb-2">กรุณาเข้าสู่ระบบ</h3>
                    <p className="text-slate-500 mb-6">เพื่อบันทึกและดูประวัติการสร้าง Label ของคุณ</p>
                    <Button onClick={handleLogin} className="mx-auto">
                      เข้าสู่ระบบด้วย Google
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {history.map(record => (
                      <Card key={record.id} className="p-4 hover:border-indigo-200 transition-all group">
                        <div className="flex justify-between items-start">
                          <div className="flex gap-4">
                            <div className="w-12 h-12 bg-indigo-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-amber-400">
                              <FileText size={24} />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">{record.recipientName}</h4>
                              <p className="text-xs text-slate-500">{record.phone} | {record.zipCode}</p>
                              <p className="text-[10px] text-slate-400 mt-1">
                                {record.createdAt?.toDate().toLocaleString('th-TH')}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-md uppercase">
                              {record.labelSize}
                            </span>
                            <Button variant="ghost" size="sm" className="opacity-0 group-hover:opacity-100" onClick={() => {
                              setQueue([...queue, {
                                id: Math.random().toString(36).substr(2, 9),
                                name: record.recipientName,
                                phone: record.phone,
                                address: record.address,
                                zipCode: record.zipCode,
                                items: record.items as Item[],
                                isValid: true,
                                errors: []
                              }]);
                              setActiveTab('preview');
                            }}>
                              Re-Queue
                            </Button>
                          </div>
                        </div>
                      </Card>
                    ))}
                    {history.length === 0 && (
                      <div className="text-center py-12 text-slate-400 italic">
                        ยังไม่มีประวัติการสร้าง Label
                      </div>
                    )}
                  </div>
                )}
              </motion.div>
            )}

            {activeTab === 'settings' && (
              <motion.div 
                key="settings"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <Card>
                  <h3 className="font-extrabold mb-6 flex items-center gap-3 text-slate-900">
                    <div className="w-10 h-10 bg-indigo-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-amber-400">
                      <Settings size={22} />
                    </div>
                    ตั้งค่าระบบ
                  </h3>
                  <div className="space-y-8">
                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-4 block tracking-widest">ข้อมูลร้านค้า</label>
                      <div className="space-y-4">
                        <div className="relative">
                          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                            <Store size={18} />
                          </div>
                          <input 
                            type="text" 
                            value={shopName}
                            onChange={(e) => setShopName(e.target.value)}
                            placeholder="ชื่อร้านค้าของคุณ (จะแสดงเป็นผู้ส่งบนฉลาก)"
                            className="w-full h-14 pl-12 pr-4 bg-slate-50 dark:bg-white/5 border-2 border-slate-100 dark:border-white/10 rounded-2xl focus:border-indigo-500 dark:focus:border-amber-400 transition-all outline-none font-bold text-slate-900 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase mb-4 block tracking-widest">ธีมการแสดงผล</label>
                      <div className="grid grid-cols-2 gap-4">
                        <button 
                          onClick={() => setDarkMode(false)}
                          className={cn(
                            "p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] text-left",
                            !darkMode ? "border-indigo-500 bg-white text-slate-900 shadow-luxury" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400"
                          )}
                        >
                          <div className="w-full h-3 bg-slate-100 rounded-full mb-3"></div>
                          <p className="text-sm font-black">Light Mode</p>
                        </button>
                        <button 
                          onClick={() => setDarkMode(true)}
                          className={cn(
                            "p-6 rounded-2xl border-2 transition-all hover:scale-[1.02] text-left",
                            darkMode ? "border-amber-400 bg-slate-900 text-white shadow-luxury" : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 text-slate-400"
                          )}
                        >
                          <div className="w-full h-3 bg-slate-800 rounded-full mb-3"></div>
                          <p className="text-sm font-black">Dark Mode</p>
                        </button>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100">
                      <label className="text-[10px] font-black text-slate-400 uppercase mb-4 block tracking-widest">การสำรองข้อมูล</label>
                      <p className="text-sm font-medium text-slate-500 mb-6">ข้อมูลของคุณจะถูกบันทึกอัตโนมัติเมื่อเข้าสู่ระบบ เพื่อความปลอดภัยสูงสุด</p>
                      <Button variant="outline" size="md" className="w-full rounded-2xl border-slate-200">
                        <Download size={18} className="text-indigo-500" />
                        ดาวน์โหลดข้อมูลทั้งหมด (.json)
                      </Button>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white dark:bg-black border-t border-slate-100 dark:border-white/10 py-12 no-print">
        <div className="max-w-[1600px] mx-auto px-8 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 gradient-primary rounded-lg flex items-center justify-center text-white shadow-sm">
              <PackageCheck size={18} />
            </div>
            <p className="text-sm font-black text-slate-900 dark:text-white">ShipLux Premium</p>
          </div>
          <p className="text-xs font-bold text-slate-400 dark:text-slate-500 tracking-widest uppercase">© 2026 ShipLux Label Solutions. All rights reserved.</p>
          <div className="flex justify-center gap-8 text-[10px] font-black uppercase tracking-widest text-slate-400">
            <a href="#" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Privacy Policy</a>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Terms of Service</a>
            <a href="#" className="hover:text-indigo-600 dark:hover:text-amber-400 transition-colors">Support</a>
          </div>
        </div>
      </footer>

      {/* Print Area (Hidden in UI) */}
      <div id="print-area" className="hidden">
        {queue.filter(q => q.isValid && (selectedQueueIds.size === 0 || selectedQueueIds.has(q.id))).map(q => (
          <div key={q.id} className={labelSize === '100x75' ? 'label-100x75 relative' : 'label-100x150'} style={{ backgroundColor: 'white', color: 'black' }}>
            {shopName && labelSize === '100x150' && (
              <div className="mb-1 pb-1 border-b flex justify-between items-center" style={{ borderColor: '#D1D5DB' }}>
                <div>
                  <p className="text-[7px] font-bold uppercase">Sender / ผู้ส่ง</p>
                  <p className="text-[10px] font-bold">{shopName}</p>
                </div>
              </div>
            )}
            <div className={cn(
              "border-b-2 border-black flex justify-between items-start",
              labelSize === '100x75' ? "pb-1 mb-1" : "pb-2 mb-2"
            )}>
              <div>
                <p className="text-[9px] font-bold uppercase">Recipient / ผู้รับ</p>
                <h3 className={cn(
                  "font-bold leading-tight",
                  labelSize === '100x75' ? "text-lg" : "text-lg"
                )}>{q.name}</h3>
              </div>
              <div className="text-right">
                <p className="text-[9px] font-bold uppercase">TEL / โทร</p>
                <p className={cn(
                  "font-bold",
                  labelSize === '100x75' ? "text-base" : "text-base"
                )}>{q.phone}</p>
              </div>
            </div>
            
            <div className="flex-grow">
              <p className="text-[9px] font-bold uppercase mb-1">Address / ที่อยู่</p>
              <p className={cn(
                "leading-relaxed",
                labelSize === '100x75' ? "text-xs" : "text-[13px]"
              )}>{q.address}</p>
              <p className={cn(
                "font-black tracking-widest",
                labelSize === '100x75' ? "text-2xl mt-2" : "text-2xl mt-3"
              )}>{q.zipCode}</p>
            </div>

            {labelSize === '100x150' && (
              <div className="mt-3 pt-3 border-t-2 border-dashed" style={{ borderColor: '#9CA3AF' }}>
                <p className="text-[9px] font-bold uppercase mb-2">Order Details</p>
                <div className="space-y-1">
                  {q.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <span>{item.name}</span>
                      <span className="font-bold">x{item.quantity}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className={cn(
              "mt-auto flex justify-between items-end",
              labelSize === '100x75' ? "pt-1" : "pt-2"
            )}>
              <div className={cn(
                "border border-black flex items-center justify-center",
                labelSize === '100x75' ? "w-12 h-12" : "w-16 h-16"
              )} style={{ backgroundColor: '#F3F4F6' }}>
                <span className="text-[8px]">QR CODE</span>
              </div>
              <div className="text-right">
                {shopName && labelSize === '100x75' && (
                  <div className="mb-0.5">
                    <p className="text-[6px] font-bold uppercase">Sender</p>
                    <p className="text-[9px] font-bold leading-none mb-1">{shopName}</p>
                  </div>
                )}
                <p className="text-[8px] font-black uppercase tracking-widest">ShipLux Premium v1.0</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Usage Modal */}
      <AnimatePresence>
        {showUsageModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowUsageModal(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white dark:bg-black rounded-3xl shadow-2xl max-w-lg w-full p-8 relative z-10 border border-transparent dark:border-white/10"
            >
              <button onClick={() => setShowUsageModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
              
              <h2 className="text-2xl font-extrabold mb-8 flex items-center gap-4 text-slate-900 dark:text-white">
                <div className="w-12 h-12 bg-indigo-50 dark:bg-amber-900/20 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-amber-400">
                  <Info size={28} />
                </div>
                วิธีการใช้งานระบบ
              </h2>

              <div className="space-y-8">
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-amber-400 text-white dark:text-black flex items-center justify-center font-black shadow-lg shadow-indigo-200 dark:shadow-none flex-shrink-0">1</div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest mb-1">Step 01: เพิ่มสินค้า</h4>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">ใส่ชื่อสินค้าและจำนวน เพื่อให้แสดงในใบปะหน้าขนาดใหญ่ (100x150) พร้อมระบบตรวจสอบสต็อกอัตโนมัติ</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-amber-400 text-white dark:text-black flex items-center justify-center font-black shadow-lg shadow-indigo-200 dark:shadow-none flex-shrink-0">2</div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest mb-1">Step 02: ใส่ข้อมูลผู้รับ</h4>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">วางข้อมูลแบบบรรทัดเดียว หรือ Import ไฟล์ CSV/Excel ระบบ AI จะช่วยแยกและแก้ไขข้อมูลให้อัตโนมัติ</p>
                  </div>
                </div>
                <div className="flex gap-5">
                  <div className="w-10 h-10 rounded-2xl bg-indigo-600 dark:bg-amber-400 text-white dark:text-black flex items-center justify-center font-black shadow-lg shadow-indigo-200 dark:shadow-none flex-shrink-0">3</div>
                  <div>
                    <h4 className="font-black text-slate-900 dark:text-white uppercase text-xs tracking-widest mb-1">Step 03: ตรวจสอบ & พิมพ์</h4>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed">เลือกขนาด Label ที่ต้องการ แล้วกดปุ่ม "สร้าง Shipping Label" เพื่อพิมพ์หรือ Export เป็น PDF ระดับพรีเมียม</p>
                  </div>
                </div>
              </div>

              <Button className="w-full mt-8" size="lg" onClick={() => setShowUsageModal(false)}>
                เข้าใจแล้ว เริ่มใช้งานเลย
              </Button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Toast */}
      <AnimatePresence>
        {error && (
          <motion.div 
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-rose-500 text-white px-6 py-3 rounded-2xl shadow-xl flex items-center gap-3"
          >
            <AlertCircle size={20} />
            <span className="font-bold">{error}</span>
            <button onClick={() => setError(null)} className="ml-2 hover:opacity-80">
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
