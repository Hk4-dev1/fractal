import { Separator } from './ui/separator';
import HkaLogo from '../logo/HKA-LOGO.svg';

export function Footer() {
  const footerLinks = [
    { label: 'About', href: '#' },
    { label: 'Support', href: '#' },
    { label: 'Terms', href: '#' },
    { label: 'Privacy', href: '#' },
    { label: 'API', href: '#' },
    { label: 'Fees', href: '#' },
  ];

  return (
    <footer className="bg-white dark:bg-slate-900 border-t border-gray-200 dark:border-slate-700 mt-12">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          {/* Logo and Copyright */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full overflow-hidden shadow-md">
              <img 
                src={HkaLogo} 
                alt="HKA-DEX Logo" 
                className="w-full h-full object-cover rounded-full"
              />
            </div>
            <div>
              <div className="font-semibold">HKA-DEX Platform</div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                © 2025 HKA-DEX Inc. All rights reserved
              </div>
            </div>
          </div>

          {/* Links */}
          <div className="flex flex-wrap justify-center md:justify-end gap-6">
            {footerLinks.map((link, index) => (
              <a
                key={index}
                href={link.href}
                className="text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>
        </div>

        <Separator className="my-6" />

        {/* Additional Info */}
        <div className="text-center">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Trading cryptocurrencies carries a high level of risk and may not be suitable for all investors. 
            Past performance is not indicative of future results.
          </p>
        </div>
      </div>
    </footer>
  );
}