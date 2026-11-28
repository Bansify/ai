import { Fingerprint, Mail, HardDrive, Video, ShoppingBag, GitBranch, Store } from 'lucide-react';
import type { RailItem } from '../ui/BansifyShell';

/** The app dock, identical to the website's: same apps, same order, same logos. */
export const APP_DOCK: RailItem[] = [
  { id: 'accounts', label: 'Bansify Accounts', icon: Fingerprint, url: 'https://accounts.bansify.com', logoSrc: 'https://accounts.bansify.com/icon-192.png' },
  { id: 'mail', label: 'Bansify Mail', icon: Mail, url: 'https://mail.bansify.com', logoSrc: 'https://mail.bansify.com/icon-192.png' },
  { id: 'drive', label: 'Bansify Drive', icon: HardDrive, url: 'https://drive.bansify.com', logoSrc: 'https://drive.bansify.com/icon-192.png' },
  { id: 'meet', label: 'Bansify Meet', icon: Video, url: 'https://meet.bansify.com', logoSrc: 'https://meet.bansify.com/icon-192.png' },
  { id: 'pay', label: 'Bansify Pay', icon: ShoppingBag, url: 'https://pay.bansify.com', logoSrc: 'https://pay.bansify.com/icon-192.png' },
  { id: 'store', label: 'Kiwi Store', icon: Store, url: 'https://store.bansify.com', logoSrc: 'https://store.bansify.com/icon-192.png' },
  { id: 'gitplus', label: 'GitPlus', icon: GitBranch, url: 'https://gitplus.bansify.com', logoSrc: 'https://gitplus.bansify.com/icon-192.png' },
];
