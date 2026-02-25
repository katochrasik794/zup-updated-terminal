import React, { useMemo } from 'react'
import eurusdIcon from '../../assets/eurusd.png'
import btcIcon from '../../assets/btc.png'

// Map currency/symbol prefixes to ISO 3166-1 alpha-2 Country Codes
const COUNTRY_MAP: Record<string, string> = {
  // Major Forex
  'EUR': 'EU', // Europe
  'USD': 'US', // USA
  'GBP': 'GB', // United Kingdom
  'JPY': 'JP', // Japan
  'AUD': 'AU', // Australia
  'CAD': 'CA', // Canada
  'CHF': 'CH', // Switzerland
  'NZD': 'NZ', // New Zealand
  'CNH': 'CN', // China
  'HKD': 'HK', // Hong Kong
  'SGD': 'SG', // Singapore
  'SEK': 'SE', // Sweden
  'NOK': 'NO', // Norway
  'DKK': 'DK', // Denmark
  'TRY': 'TR', // Turkey
  'ZAR': 'ZA', // South Africa
  'MXN': 'MX', // Mexico
  'BRL': 'BR', // Brazil
  'INR': 'IN', // India
  'RUB': 'RU', // Russia
  'KRW': 'KR', // South Korea
  'IDR': 'ID', // Indonesia
  'PLN': 'PL', // Poland
  'THB': 'TH', // Thailand
  'MYR': 'MY', // Malaysia
  'HUF': 'HU', // Hungary
  'CZK': 'CZ', // Czech Republic
  'ILS': 'IL', // Israel
  'CLP': 'CL', // Chile
  'COP': 'CO', // Colombia
  'PHP': 'PH', // Philippines
  'AED': 'AE', // UAE
  'SAR': 'SA', // Saudi Arabia
  'TWD': 'TW', // Taiwan
}

// Indices often start with country code or specific aliases
const INDICES_MAP: Record<string, string> = {
  'US30': 'US',
  'US100': 'US',
  'US500': 'US',
  'USTEC': 'US',
  'NAS100': 'US',
  'SPX500': 'US',
  'GER30': 'DE',
  'DE30': 'DE',
  'UK100': 'GB',
  'JP225': 'JP',
  'AUS200': 'AU',
  'EU50': 'EU',
  'FRA40': 'FR',
  'IT40': 'IT',
  'ES35': 'ES',
  'HK50': 'HK',
}

interface FlagIconProps {
  symbol?: string;
  type?: string; // Backwards compatibility
  className?: string;
}

export default function FlagIcon({ symbol, type, className = "" }: FlagIconProps) {
  const rawSymbol = (symbol || type || '').toUpperCase().replace('/', '');
  // Remove common separators like . - _ if they exist before processing? usually raw replacement is fine.
  const finalSymbol = rawSymbol;

  const baseClass = `relative w-full h-full flex items-center justify-center ${className}`
  const flagUrl = (code: string) => `https://flagcdn.com/w80/${code.toLowerCase()}.png`
  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    e.currentTarget.classList.add('opacity-0');
  };

  // ---------------------------------------------------------
  // 1. Identify Components (Base & Quote)
  // ---------------------------------------------------------

  let baseElement: React.ReactNode = null;
  let quoteCode: string | null = null;
  let baseSymbol = finalSymbol;

  // A. Check Indices (Priority)
  // Sorted keys by length desc to match 'US100' before 'US'
  const indexMatch = Object.keys(INDICES_MAP).find(key => finalSymbol.startsWith(key));
  if (indexMatch) {
    return (
      <div className={`${baseClass} rounded-full overflow-hidden border-[1px] border-background`}>
        <img
          src={flagUrl(INDICES_MAP[indexMatch])}
          alt={indexMatch}
          className="w-full h-full object-cover scale-150 transition-opacity duration-200"
          onError={handleImageError}
        />
      </div>
    )
  }

  // B. Determine Base & Quote logic

  // Try standard 6-char Pair Logic (Base 3 + Quote 3)
  // Logic: If the symbol starts with 2 known country codes?
  if (finalSymbol.length >= 6) {
    const p1 = finalSymbol.substring(0, 3);
    const p2 = finalSymbol.substring(3, 6);

    // Known Country Codes Pair (EURUSDm, GBPUSDpro)
    if (COUNTRY_MAP[p1] && COUNTRY_MAP[p2]) {
      baseSymbol = p1;
      quoteCode = COUNTRY_MAP[p2];
    }
    // X-Custom + Quote (XAUUSD, BTCUSD)
    else if (COUNTRY_MAP[p2]) {
      // e.g. XAUUSD... check if p1 is custom?
      // Let flow down to Custom Base detection
      // But we need to know the split
      baseSymbol = p1;
      quoteCode = COUNTRY_MAP[p2];
    }
    else if (finalSymbol.includes('USD')) {
      quoteCode = 'US';
      const idx = finalSymbol.indexOf('USD');
      if (idx > 0) baseSymbol = finalSymbol.substring(0, idx);
    }
    else if (finalSymbol.includes('EUR')) {
      quoteCode = 'EU';
      const idx = finalSymbol.indexOf('EUR');
      if (idx > 0) baseSymbol = finalSymbol.substring(0, idx);
    }
  } else {
    // Short symbol?
    if (finalSymbol.endsWith('USD')) {
      quoteCode = 'US';
      baseSymbol = finalSymbol.replace('USD', '');
    }
  }

  // C. Resolve Base Icon
  if (baseSymbol === 'BTC' || baseSymbol.includes('BTC')) baseElement = <CustomIcon src={btcIcon.src} alt="BTC" className={className} />;
  else if (baseSymbol === 'ETH' || baseSymbol.includes('ETH')) baseElement = <GenericCryptoIcon symbol="ETH" className={className} />;
  else if (baseSymbol === 'XAU' || baseSymbol.startsWith('XAU')) baseElement = <GoldIcon className={className} />;
  else if (baseSymbol === 'XAG' || baseSymbol.startsWith('XAG')) baseElement = <SilverIcon className={className} />;
  else if (baseSymbol === 'XPD' || baseSymbol.startsWith('XPD')) baseElement = <GenericMetalIcon color="#E5E4E2" className={className} />;
  else if (baseSymbol === 'XPT' || baseSymbol.startsWith('XPT')) baseElement = <GenericMetalIcon color="#E5E4E2" className={className} />;
  else if (COUNTRY_MAP[baseSymbol]) {
    baseElement = (
      <img
        src={flagUrl(COUNTRY_MAP[baseSymbol])}
        alt={baseSymbol}
        className="w-full h-full object-cover scale-150 transition-opacity duration-200"
        onError={handleImageError}
      />
    );
  }

  // ---------------------------------------------------------
  // 2. Render
  // ---------------------------------------------------------

  // Double Icon
  if (quoteCode) {
    const TopLeft = baseElement || (
      <div className="w-full h-full bg-gray-900 flex items-center justify-center">
        <span className="text-[9px] font-bold text-gray-400">{baseSymbol.substring(0, 1)}</span>
      </div>
    );

    return (
      <div className={baseClass}>
        <div className="absolute top-0 left-0 w-[70%] h-[70%] rounded-full z-10 overflow-hidden bg-[#141d22] border-[1px] border-background">
          {TopLeft}
        </div>
        <div className="absolute bottom-0 right-0 w-[70%] h-[70%] rounded-full z-20 overflow-hidden bg-[#141d22] border-[1px] border-background">
          <img
            src={flagUrl(quoteCode)}
            alt={quoteCode}
            className="w-full h-full object-cover scale-150 transition-opacity duration-200"
            onError={handleImageError}
          />
        </div>
      </div>
    );
  }

  // Single Icon
  if (baseElement) {
    if ((baseElement as any).type === 'img') {
      return (
        <div className={`${baseClass} rounded-full overflow-hidden border-[1px] border-background`}>
          {baseElement}
        </div>
      )
    }
    return (
      <div className={`${baseClass} rounded-full overflow-hidden border-[1px] border-background`}>
        {React.cloneElement(baseElement as React.ReactElement, { className: 'w-full h-full' } as any)}
      </div>
    );
  }

  // Final Fallback
  return (
    <div className={`${baseClass} bg-gray-900 rounded-full flex items-center justify-center border border-gray-700`}>
      <span className="text-[9px] font-bold text-gray-400">{finalSymbol.substring(0, 1)}</span>
    </div>
  )
}

// Custom Sub-components
const CustomIcon = ({ src, alt, className }: any) => (
  <div className={`relative w-full h-full rounded-full overflow-hidden bg-gray-900 ${className}`}>
    <img src={src} alt={alt} className="w-full h-full object-cover" />
  </div>
)

const GenericCryptoIcon = ({ symbol, className }: any) => (
  <div className={`relative w-full h-full rounded-full flex items-center justify-center bg-orange-500/10 text-orange-500 ${className}`}>
    <span className="text-[8px] font-bold">₿</span>
  </div>
)

const GoldIcon = ({ className }: any) => (
  <div className={`relative w-full h-full ${className}`}>
    {/* Helper to overlap with US flag if it's XAUUSD? Logic implies purely Gold Icon for simplicity or we can check XAUUSD */}
    <div className="w-full h-full rounded-full bg-[#141d22] flex items-center justify-center border-[1px] border-[#e8d3a3]/30">
      <div className="w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#e8d3a3] to-[#8b6c42] flex items-center justify-center">
        <span className="text-[6px] font-bold text-[#3e2e17] leading-none text-center">Au</span>
      </div>
    </div>
  </div>
)

const SilverIcon = ({ className }: any) => (
  <div className={`relative w-full h-full ${className} rounded-full bg-[#141d22] flex items-center justify-center border-[1px] border-[#C0C0C0]/30`}>
    <div className="w-[80%] h-[80%] rounded-full bg-gradient-to-br from-[#FFFFFF] to-[#C0C0C0] flex items-center justify-center">
      <span className="text-[6px] font-bold text-[#3e3e3e] leading-none text-center">Ag</span>
    </div>
  </div>
)

const GenericMetalIcon = ({ color, className }: any) => (
  <div className={`relative w-full h-full ${className} rounded-full bg-[#141d22] flex items-center justify-center`}>
    <div className="w-[80%] h-[80%] rounded-full" style={{ backgroundColor: color }}></div>
  </div>
)
