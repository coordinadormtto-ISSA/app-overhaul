import { readMediaFromIdb, writeMediaToIdb, deleteMediaFromIdb } from './mediaCacheDb';
import { getCompanyLogo, hydrateCompanyLogo, saveCompanyLogo } from '../assets/logo';

// Storage and management of custom menu images for Huevos Kikes Overhaul App

export interface MenuItemImageConfig {
  key: string;
  category: 'PRINCIPAL' | 'VACIO' | 'ZONAS' | 'CARGA';
  title: string;
  subtitle: string;
  defaultImage: string;
  recommendedAspect: string;
}

// Crisp, beautiful SVG illustration data URIs matching the user's reference farm illustrations
const DEFAULT_BARN_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <defs>
    <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0F2FE"/>
      <stop offset="100%" stop-color="#BAE6FD"/>
    </linearGradient>
    <linearGradient id="hillGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#84CC16"/>
      <stop offset="100%" stop-color="#65A30D"/>
    </linearGradient>
    <linearGradient id="barnGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EF4444"/>
      <stop offset="100%" stop-color="#DC2626"/>
    </linearGradient>
    <linearGradient id="roofGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#991B1B"/>
      <stop offset="100%" stop-color="#7F1D1D"/>
    </linearGradient>
  </defs>
  
  <!-- Sky background circle -->
  <circle cx="200" cy="160" r="140" fill="url(#skyGrad)"/>
  
  <!-- Clouds -->
  <path d="M100 90 Q110 75 125 80 Q140 70 155 85 Q170 80 175 95 L95 95 Z" fill="#FFFFFF" opacity="0.85"/>
  <path d="M260 110 Q270 98 282 102 Q295 95 305 107 Q315 103 320 115 L255 115 Z" fill="#FFFFFF" opacity="0.85"/>
  
  <!-- Green Rolling Hills -->
  <ellipse cx="140" cy="270" rx="140" ry="70" fill="url(#hillGrad)"/>
  <ellipse cx="270" cy="280" rx="150" ry="80" fill="#4D7C0F"/>
  <ellipse cx="200" cy="285" rx="160" ry="60" fill="url(#hillGrad)"/>

  <!-- Bushes / Vegetation -->
  <circle cx="90" cy="250" r="22" fill="#15803D"/>
  <circle cx="110" cy="255" r="18" fill="#166534"/>
  <circle cx="75" cy="258" r="15" fill="#14532D"/>
  <circle cx="310" cy="252" r="22" fill="#15803D"/>
  <circle cx="330" cy="256" r="18" fill="#166534"/>

  <!-- Silo on the left -->
  <path d="M115 140 L115 230 L145 230 L145 140 Z" fill="#E2E8F0"/>
  <path d="M115 140 Q130 115 145 140 Z" fill="#94A3B8"/>
  <line x1="115" y1="165" x2="145" y2="165" stroke="#CBD5E1" stroke-width="2"/>
  <line x1="115" y1="195" x2="145" y2="195" stroke="#CBD5E1" stroke-width="2"/>

  <!-- Red Barn Body -->
  <rect x="145" y="145" width="110" height="95" fill="url(#barnGrad)" rx="2"/>
  
  <!-- Barn Roof -->
  <polygon points="135,148 200,85 265,148" fill="url(#roofGrad)"/>
  <polygon points="140,147 200,90 260,147" fill="#B91C1C"/>

  <!-- Barn Attic Window -->
  <polygon points="180,140 200,118 220,140" fill="#FEF08A"/>
  <line x1="200" y1="118" x2="200" y2="140" stroke="#78350F" stroke-width="2"/>
  <line x1="187" y1="130" x2="213" y2="130" stroke="#78350F" stroke-width="2"/>

  <!-- White Barn Trim & Crosses -->
  <!-- Windows -->
  <rect x="156" y="160" width="22" height="22" fill="#38BDF8" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="167" y1="160" x2="167" y2="182" stroke="#FFFFFF" stroke-width="2"/>
  <line x1="156" y1="171" x2="178" y2="171" stroke="#FFFFFF" stroke-width="2"/>

  <rect x="222" y="160" width="22" height="22" fill="#38BDF8" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="233" y1="160" x2="233" y2="182" stroke="#FFFFFF" stroke-width="2"/>
  <line x1="222" y1="171" x2="244" y2="171" stroke="#FFFFFF" stroke-width="2"/>

  <!-- Barn Big Doors -->
  <rect x="180" y="185" width="40" height="55" fill="#FFFFFF" rx="1"/>
  <rect x="183" y="188" width="34" height="52" fill="#B91C1C"/>
  <line x1="183" y1="188" x2="217" y2="240" stroke="#FFFFFF" stroke-width="3"/>
  <line x1="183" y1="240" x2="217" y2="188" stroke="#FFFFFF" stroke-width="3"/>
  <rect x="183" y="188" width="34" height="52" fill="none" stroke="#FFFFFF" stroke-width="2"/>
</svg>
`)}`;

const DEFAULT_COOP_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <defs>
    <linearGradient id="coopSky" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#E0F7FA"/>
      <stop offset="100%" stop-color="#B2EBF2"/>
    </linearGradient>
    <linearGradient id="coopWood" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#B45309"/>
      <stop offset="100%" stop-color="#92400E"/>
    </linearGradient>
    <linearGradient id="coopRoof" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#0284C7"/>
      <stop offset="100%" stop-color="#0369A1"/>
    </linearGradient>
  </defs>

  <!-- Sky circle -->
  <circle cx="200" cy="160" r="140" fill="url(#coopSky)"/>

  <!-- Ground -->
  <ellipse cx="200" cy="275" rx="150" ry="50" fill="#65A30D"/>
  <ellipse cx="200" cy="285" rx="160" ry="40" fill="#4D7C0F"/>

  <!-- Fence -->
  <path d="M70 230 L70 260 M90 230 L90 260 M110 230 L110 260 M310 230 L310 260 M330 230 L330 260" stroke="#D97706" stroke-width="4" stroke-linecap="round"/>
  <line x1="60" y1="240" x2="120" y2="240" stroke="#B45309" stroke-width="3"/>
  <line x1="60" y1="252" x2="120" y2="252" stroke="#B45309" stroke-width="3"/>
  <line x1="300" y1="240" x2="340" y2="240" stroke="#B45309" stroke-width="3"/>

  <!-- Wooden Chicken Coop House -->
  <rect x="135" y="140" width="130" height="90" fill="url(#coopWood)" rx="3"/>
  
  <!-- Planks lines -->
  <line x1="135" y1="160" x2="265" y2="160" stroke="#78350F" stroke-width="1.5"/>
  <line x1="135" y1="180" x2="265" y2="180" stroke="#78350F" stroke-width="1.5"/>
  <line x1="135" y1="200" x2="265" y2="200" stroke="#78350F" stroke-width="1.5"/>

  <!-- Coop Roof -->
  <polygon points="120,145 200,90 280,145" fill="url(#coopRoof)"/>

  <!-- Coop Windows / Nest boxes -->
  <rect x="195" y="150" width="60" height="35" fill="#451A03" rx="2"/>
  <line x1="225" y1="150" x2="225" y2="185" stroke="#78350F" stroke-width="2"/>

  <!-- Hens inside window -->
  <circle cx="210" cy="168" r="8" fill="#F59E0B"/>
  <polygon points="204,168 200,170 204,172" fill="#DC2626"/>
  <circle cx="240" cy="168" r="8" fill="#FFFFFF"/>
  <polygon points="246,168 250,170 246,172" fill="#DC2626"/>

  <!-- Coop Main Door & Ramp -->
  <path d="M150 185 Q165 170 180 185 L180 230 L150 230 Z" fill="#292524"/>
  <!-- Wooden Ramp -->
  <polygon points="145,230 185,230 140,265 125,260" fill="#92400E"/>
  <line x1="140" y1="240" x2="165" y2="245" stroke="#78350F" stroke-width="2"/>
  <line x1="135" y1="250" x2="155" y2="255" stroke="#78350F" stroke-width="2"/>

  <!-- Main Hen in front on grass -->
  <ellipse cx="205" cy="255" rx="16" ry="13" fill="#D97706"/>
  <circle cx="218" cy="245" r="9" fill="#D97706"/>
  <!-- Comb -->
  <path d="M216 236 Q220 230 224 236" fill="#DC2626" stroke="#DC2626" stroke-width="3"/>
  <!-- Beak -->
  <polygon points="227,244 233,246 227,248" fill="#F59E0B"/>
  <!-- Eye -->
  <circle cx="221" cy="243" r="1.5" fill="#000000"/>
  <!-- Nest / Eggs -->
  <ellipse cx="205" cy="265" rx="20" ry="7" fill="#FDE68A"/>
  <ellipse cx="198" cy="262" rx="4" ry="5" fill="#FFFFFF"/>
  <ellipse cx="206" cy="261" rx="4" ry="5" fill="#FFFFFF"/>
  <ellipse cx="213" cy="263" rx="4" ry="5" fill="#FFFFFF"/>

  <!-- Hen walking on ramp -->
  <ellipse cx="160" cy="220" rx="10" ry="8" fill="#F59E0B"/>
  <circle cx="168" cy="214" r="6" fill="#F59E0B"/>
  <polygon points="174,213 178,215 174,217" fill="#EF4444"/>

  <!-- White Hen on grass left -->
  <ellipse cx="110" cy="260" rx="12" ry="9" fill="#FFFFFF"/>
  <circle cx="102" cy="253" r="7" fill="#FFFFFF"/>
  <polygon points="95,253 91,255 95,257" fill="#F59E0B"/>
  <path d="M103 246 Q106 242 109 246" fill="#DC2626" stroke="#DC2626" stroke-width="2"/>
</svg>
`)}`;

const DEFAULT_PEOPLE_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <defs>
    <linearGradient id="peopleBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#EFF6FF"/>
      <stop offset="100%" stop-color="#DBEAFE"/>
    </linearGradient>
  </defs>

  <!-- Backdrop circle -->
  <circle cx="200" cy="160" r="140" fill="url(#peopleBg)"/>

  <!-- Little sparkles -->
  <path d="M110 90 L113 98 L121 101 L113 104 L110 112 L107 104 L99 101 L107 98 Z" fill="#F59E0B"/>
  <path d="M290 85 L292 91 L298 93 L292 95 L290 101 L288 95 L282 93 L288 91 Z" fill="#EC4899"/>
  <path d="M295 240 L297 245 L302 247 L297 249 L295 254 L293 249 L288 247 L293 245 Z" fill="#3B82F6"/>

  <!-- Row 1 (Back Row): 3 avatars -->
  <!-- Left back (Purple) -->
  <circle cx="140" cy="115" r="18" fill="#FED7AA" stroke="#1E293B" stroke-width="3"/>
  <path d="M125 108 Q140 92 155 108" fill="#475569"/>
  <path d="M115 155 C115 135 165 135 165 155 Z" fill="#A855F7" stroke="#1E293B" stroke-width="3"/>

  <!-- Center back (Dark Teal) -->
  <circle cx="200" cy="105" r="18" fill="#FDE047" stroke="#1E293B" stroke-width="3"/>
  <path d="M185 98 Q200 82 215 98" fill="#1E293B"/>
  <path d="M175 145 C175 125 225 125 225 145 Z" fill="#0D9488" stroke="#1E293B" stroke-width="3"/>

  <!-- Right back (Green) -->
  <circle cx="260" cy="115" r="18" fill="#FECDD3" stroke="#1E293B" stroke-width="3"/>
  <path d="M245 108 Q260 92 275 108" fill="#78350F"/>
  <path d="M235 155 C235 135 285 135 285 155 Z" fill="#22C55E" stroke="#1E293B" stroke-width="3"/>

  <!-- Row 2 (Middle Row): 3 avatars -->
  <!-- Left middle (Lime) -->
  <circle cx="120" cy="165" r="18" fill="#FED7AA" stroke="#1E293B" stroke-width="3"/>
  <path d="M105 158 Q120 142 135 158" fill="#334155"/>
  <path d="M95 210 C95 185 145 185 145 210 Z" fill="#84CC16" stroke="#1E293B" stroke-width="3"/>

  <!-- Center middle (Orange/Red) -->
  <circle cx="200" cy="155" r="18" fill="#FED7AA" stroke="#1E293B" stroke-width="3"/>
  <path d="M185 148 Q200 132 215 148" fill="#991B1B"/>
  <path d="M175 200 C175 175 225 175 225 200 Z" fill="#F43F5E" stroke="#1E293B" stroke-width="3"/>

  <!-- Right middle (Yellow) -->
  <circle cx="280" cy="165" r="18" fill="#FEF08A" stroke="#1E293B" stroke-width="3"/>
  <path d="M265 158 Q280 142 295 158" fill="#1E293B"/>
  <path d="M255 210 C255 185 305 185 305 210 Z" fill="#EAB308" stroke="#1E293B" stroke-width="3"/>

  <!-- Row 3 (Front Leader): Big Center avatar (Cyan/Blue) -->
  <circle cx="160" cy="205" r="18" fill="#FED7AA" stroke="#1E293B" stroke-width="3"/>
  <path d="M145 198 Q160 182 175 198" fill="#312E81"/>
  <path d="M135 255 C135 230 185 230 185 255 Z" fill="#8B5CF6" stroke="#1E293B" stroke-width="3"/>

  <!-- Front Right avatar (Blue) -->
  <circle cx="240" cy="205" r="18" fill="#FDE047" stroke="#1E293B" stroke-width="3"/>
  <path d="M225 198 Q240 182 255 198" fill="#7C2D12"/>
  <path d="M215 255 C215 230 265 230 265 255 Z" fill="#38BDF8" stroke="#1E293B" stroke-width="3"/>

  <!-- Foreground Main Character -->
  <circle cx="200" cy="225" r="20" fill="#FED7AA" stroke="#1E293B" stroke-width="3.5"/>
  <path d="M182 216 Q200 196 218 216" fill="#0F172A"/>
  <path d="M170 280 C170 250 230 250 230 280 Z" fill="#0284C7" stroke="#1E293B" stroke-width="3.5"/>
</svg>
`)}`;

const DEFAULT_CUSTOMIZE_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <defs>
    <linearGradient id="customBg" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#FDF4FF"/>
      <stop offset="100%" stop-color="#FAE8FF"/>
    </linearGradient>
  </defs>
  <circle cx="200" cy="160" r="140" fill="url(#customBg)"/>
  
  <!-- Artist Palette -->
  <path d="M130 180 C120 140 150 100 200 100 C260 100 290 140 280 190 C270 230 230 240 200 240 C185 240 180 230 170 230 C160 230 155 240 145 235 C135 230 135 200 130 180 Z" fill="#FDE047" stroke="#78350F" stroke-width="4"/>
  
  <!-- Thumb Hole -->
  <ellipse cx="250" cy="195" rx="12" ry="16" fill="#FAE8FF" stroke="#78350F" stroke-width="3"/>

  <!-- Color Spots on Palette -->
  <circle cx="165" cy="140" r="11" fill="#EF4444"/>
  <circle cx="200" cy="125" r="11" fill="#3B82F6"/>
  <circle cx="238" cy="135" r="11" fill="#10B981"/>
  <circle cx="262" cy="160" r="11" fill="#A855F7"/>
  <circle cx="160" cy="175" r="11" fill="#F97316"/>

  <!-- Paint Brush crossing -->
  <path d="M120 250 L270 100 L285 115 L135 265 Z" fill="#92400E" stroke="#451A03" stroke-width="2"/>
  <rect x="250" y="105" width="22" height="18" transform="rotate(-45 261 114)" fill="#94A3B8" stroke="#475569" stroke-width="1.5"/>
  <path d="M268 95 C280 80 295 90 285 105 Z" fill="#0D9488"/>
</svg>
`)}`;

const DEFAULT_REPORT_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#ECFDF5"/>
  <!-- Clipboard -->
  <rect x="140" y="70" width="120" height="175" rx="8" fill="#047857" stroke="#065F46" stroke-width="3"/>
  <rect x="150" y="90" width="100" height="145" rx="4" fill="#FFFFFF"/>
  <!-- Clip -->
  <rect x="175" y="60" width="50" height="22" rx="4" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
  <circle cx="200" cy="70" r="4" fill="#FFFFFF"/>
  <!-- Document Lines -->
  <line x1="165" y1="115" x2="235" y2="115" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/>
  <line x1="165" y1="135" x2="235" y2="135" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/>
  <line x1="165" y1="155" x2="235" y2="155" stroke="#CBD5E1" stroke-width="4" stroke-linecap="round"/>
  <!-- Checkmark -->
  <circle cx="170" cy="185" r="10" fill="#10B981"/>
  <path d="M166 185 L169 188 L175 181" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round"/>
  <line x1="188" y1="185" x2="235" y2="185" stroke="#64748B" stroke-width="3" stroke-linecap="round"/>
  <!-- Pencil -->
  <polygon points="230,240 270,170 285,180 245,250" fill="#F59E0B" stroke="#B45309" stroke-width="2"/>
  <polygon points="230,240 225,255 245,250" fill="#FEF08A"/>
  <polygon points="225,255 223,257 228,255" fill="#1E293B"/>
</svg>
`)}`;

const DEFAULT_HISTORICO_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#F0FDF4"/>
  <!-- Folder Stack -->
  <path d="M125 150 L160 150 L175 165 L275 165 L275 235 L125 235 Z" fill="#10B981" opacity="0.4"/>
  <path d="M135 130 L170 130 L185 145 L285 145 L285 225 L135 225 Z" fill="#059669" opacity="0.7"/>
  <path d="M145 110 L180 110 L195 125 L295 125 L295 215 L145 215 Z" fill="#047857"/>
  <!-- Clock Badge -->
  <circle cx="170" cy="180" r="32" fill="#FFFFFF" stroke="#047857" stroke-width="5"/>
  <circle cx="170" cy="180" r="3" fill="#047857"/>
  <line x1="170" y1="180" x2="170" y2="162" stroke="#047857" stroke-width="3" stroke-linecap="round"/>
  <line x1="170" y1="180" x2="184" y2="180" stroke="#047857" stroke-width="3" stroke-linecap="round"/>
</svg>
`)}`;

const DEFAULT_INDICADORES_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#F8FAFC"/>
  <!-- Dashboard Board -->
  <rect x="120" y="80" width="160" height="150" rx="10" fill="#FFFFFF" stroke="#0284C7" stroke-width="3"/>
  <!-- Bar Charts -->
  <rect x="145" y="160" width="18" height="50" fill="#38BDF8" rx="2"/>
  <rect x="175" y="130" width="18" height="80" fill="#0284C7" rx="2"/>
  <rect x="205" y="110" width="18" height="100" fill="#0369A1" rx="2"/>
  <rect x="235" y="145" width="18" height="65" fill="#10B981" rx="2"/>
  <!-- Trend Line -->
  <path d="M150 150 L184 120 L214 100 L244 135" fill="none" stroke="#F59E0B" stroke-width="4" stroke-linecap="round"/>
  <circle cx="214" cy="100" r="5" fill="#EF4444"/>
</svg>
`)}`;

const DEFAULT_ZUCAMI_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#ECFDF5"/>
  <!-- Automated Cage Tier Rows (Zucami) -->
  <rect x="120" y="80" width="160" height="42" fill="#059669" rx="3"/>
  <rect x="120" y="132" width="160" height="42" fill="#047857" rx="3"/>
  <rect x="120" y="184" width="160" height="42" fill="#065F46" rx="3"/>
  <!-- Vertical Support pillars -->
  <rect x="110" y="70" width="12" height="165" fill="#94A3B8"/>
  <rect x="278" y="70" width="12" height="165" fill="#94A3B8"/>
  <!-- Egg belt conveyor track -->
  <rect x="130" y="114" width="140" height="6" fill="#F59E0B"/>
  <rect x="130" y="166" width="140" height="6" fill="#F59E0B"/>
  <rect x="130" y="218" width="140" height="6" fill="#F59E0B"/>
  <!-- Eggs on belt -->
  <circle cx="160" cy="117" r="4" fill="#FFFFFF"/>
  <circle cx="190" cy="117" r="4" fill="#FFFFFF"/>
  <circle cx="230" cy="117" r="4" fill="#FFFFFF"/>
</svg>
`)}`;

const DEFAULT_SALMET_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#FFFBEB"/>
  <!-- Salmet Multitier System -->
  <rect x="125" y="85" width="150" height="40" fill="#D97706" rx="3"/>
  <rect x="125" y="135" width="150" height="40" fill="#B45309" rx="3"/>
  <rect x="125" y="185" width="150" height="40" fill="#92400E" rx="3"/>
  <!-- Steel Mesh Grid Pattern -->
  <line x1="125" y1="105" x2="275" y2="105" stroke="#FEF3C7" stroke-width="2"/>
  <line x1="125" y1="155" x2="275" y2="155" stroke="#FEF3C7" stroke-width="2"/>
  <line x1="125" y1="205" x2="275" y2="205" stroke="#FEF3C7" stroke-width="2"/>
  <!-- Feeder Line & Hopper -->
  <polygon points="110,80 135,80 122,120" fill="#DC2626"/>
  <polygon points="265,80 290,80 278,120" fill="#DC2626"/>
</svg>
`)}`;

const DEFAULT_PISO_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#F0F9FF"/>
  <!-- Floor Hen House / Galpón de Piso -->
  <polygon points="120,160 200,105 280,160" fill="#0284C7"/>
  <rect x="130" y="160" width="140" height="75" fill="#E2E8F0"/>
  <!-- Open Air Mesh Curtains -->
  <rect x="140" y="170" width="120" height="35" fill="#BAE6FD" opacity="0.6"/>
  <line x1="140" y1="180" x2="260" y2="180" stroke="#0284C7" stroke-width="1.5" stroke-dasharray="4"/>
  <line x1="140" y1="192" x2="260" y2="192" stroke="#0284C7" stroke-width="1.5" stroke-dasharray="4"/>
  <!-- Floor bedding / wood shavings -->
  <ellipse cx="200" cy="245" rx="90" ry="15" fill="#FEF08A"/>
  <!-- Hens roaming on floor -->
  <ellipse cx="170" cy="240" rx="9" ry="7" fill="#D97706"/>
  <circle cx="176" cy="235" r="4" fill="#D97706"/>
  <ellipse cx="220" cy="242" rx="9" ry="7" fill="#FFFFFF"/>
  <circle cx="214" cy="237" r="4" fill="#FFFFFF"/>
</svg>
`)}`;

const DEFAULT_ROBLE_ILLUSTRATION = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 320" width="100%" height="100%">
  <circle cx="200" cy="160" r="140" fill="#CCFBF1"/>
  <!-- El Roble Special Structures & Greenery -->
  <path d="M120 220 L150 140 L180 220 Z" fill="#0D9488"/>
  <path d="M220 220 L250 140 L280 220 Z" fill="#0F766E"/>
  <rect x="160" y="150" width="80" height="80" fill="#14B8A6" rx="4"/>
  <polygon points="150,150 200,105 250,150" fill="#042F2E"/>
  <rect x="185" y="180" width="30" height="50" fill="#FFFFFF"/>
</svg>
`)}`;

export const MENU_ITEMS_CATALOG: MenuItemImageConfig[] = [
  // 1. Menú Principal (Inicio)
  {
    key: 'menu_entregas_vacio',
    category: 'PRINCIPAL',
    title: 'ENTREGAS EN VACIO',
    subtitle: 'Reportes, Histórico e Indicadores de Overhaul sin aves',
    defaultImage: DEFAULT_BARN_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'menu_pruebas_carga',
    category: 'PRINCIPAL',
    title: 'PRUEBAS CON CARGA',
    subtitle: 'Completar y consultar actas de verificación con producción',
    defaultImage: DEFAULT_COOP_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'menu_indicadores',
    category: 'PRINCIPAL',
    title: 'INDICADORES',
    subtitle: 'Medición por grupos [A], [B], [C] y configuración por formulario',
    defaultImage: DEFAULT_INDICADORES_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'menu_personas',
    category: 'PRINCIPAL',
    title: 'PERSONAS',
    subtitle: 'Directorio de coordinadores, auxiliares y supervisores',
    defaultImage: DEFAULT_PEOPLE_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'menu_personalizacion',
    category: 'PRINCIPAL',
    title: 'PERSONALIZACION',
    subtitle: 'Subir y administrar imágenes personalizadas para todos los menús',
    defaultImage: DEFAULT_CUSTOMIZE_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },

  // 2. Submenú Entregas en Vacío
  {
    key: 'submenu_nuevo_reporte',
    category: 'VACIO',
    title: 'NUEVO REPORTE',
    subtitle: 'Crear informe de evaluación por zona',
    defaultImage: DEFAULT_REPORT_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'submenu_historico',
    category: 'VACIO',
    title: 'HISTORICO VACIO',
    subtitle: 'Consultar actas anteriores en vacío',
    defaultImage: DEFAULT_HISTORICO_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'submenu_indicadores',
    category: 'VACIO',
    title: 'INDICADORES',
    subtitle: 'Dashboard de % cumplimiento y KPIs',
    defaultImage: DEFAULT_INDICADORES_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },

  // 3. Zonas / Sistemas
  {
    key: 'zone_zucami',
    category: 'ZONAS',
    title: 'ZUCAMI',
    subtitle: 'Sistema de Jaulas Automatizadas Zucami',
    defaultImage: DEFAULT_ZUCAMI_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'zone_salmet',
    category: 'ZONAS',
    title: 'SALMET',
    subtitle: 'Sistema de Jaulas Salmet en Multinivel',
    defaultImage: DEFAULT_SALMET_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'zone_granjas_piso',
    category: 'ZONAS',
    title: 'GRANJAS PISO',
    subtitle: 'Galpones de Alojamiento Tradicional en Piso',
    defaultImage: DEFAULT_PISO_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'zone_el_roble',
    category: 'ZONAS',
    title: 'EL ROBLE',
    subtitle: 'Estructuras Especiales El Roble',
    defaultImage: DEFAULT_ROBLE_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },

  // 4. Submenú Pruebas con Carga
  {
    key: 'submenu_completar_acta',
    category: 'CARGA',
    title: 'COMPLETAR ACTA',
    subtitle: 'Diligenciar acta de prueba técnica con carga de aves',
    defaultImage: DEFAULT_COOP_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  },
  {
    key: 'submenu_historico_actas',
    category: 'CARGA',
    title: 'HISTORICO DE ACTAS',
    subtitle: 'Consultar actas históricas con carga y firmas',
    defaultImage: DEFAULT_HISTORICO_ILLUSTRATION,
    recommendedAspect: '500 x 500 px (1:1)'
  }
];

export const STORAGE_KEY = 'kikes_menu_custom_images';
const IDB_MENU_IMAGES_KEY = 'menu_custom_images';

let memoryCustomImages: Record<string, string> | null = null;
let imagesMutatedInSession = false;

function getDefaultImageMap(): Record<string, string> {
  const defaults: Record<string, string> = {};
  MENU_ITEMS_CATALOG.forEach((item) => {
    defaults[item.key] = item.defaultImage;
  });
  return defaults;
}

function stripDefaultMenuImages(rawMap: Record<string, unknown> | null | undefined): Record<string, string> {
  const clean: Record<string, string> = {};
  if (!rawMap || typeof rawMap !== 'object') return clean;

  const defaults = getDefaultImageMap();
  Object.entries(rawMap).forEach(([key, val]) => {
    if (typeof val !== 'string') return;
    const trimmed = val.trim();
    if (!trimmed) return;
    if (defaults[key] && trimmed === defaults[key]) return;
    if (
      trimmed.startsWith('data:image/') ||
      trimmed.startsWith('http') ||
      trimmed.startsWith('<svg') ||
      trimmed.startsWith('blob:')
    ) {
      clean[key] = trimmed;
    }
  });
  return clean;
}

function loadCustomOverridesSync(): Record<string, string> {
  if (memoryCustomImages !== null) {
    return { ...memoryCustomImages };
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      memoryCustomImages = {};
      return {};
    }
    const parsed = JSON.parse(raw);
    const clean = stripDefaultMenuImages(parsed);
    memoryCustomImages = clean;

    // Clean out any legacy bloated default SVGs stored inside localStorage
    const parsedKeysCount = parsed && typeof parsed === 'object' ? Object.keys(parsed).length : 0;
    if (parsedKeysCount !== Object.keys(clean).length) {
      try {
        if (Object.keys(clean).length === 0) {
          localStorage.removeItem(STORAGE_KEY);
        } else {
          const compact = JSON.stringify(clean);
          if (compact.length <= 1_500_000) {
            localStorage.setItem(STORAGE_KEY, compact);
          } else {
            localStorage.removeItem(STORAGE_KEY);
          }
        }
      } catch {
        try {
          localStorage.removeItem(STORAGE_KEY);
        } catch {}
      }
    }

    return { ...clean };
  } catch {
    memoryCustomImages = {};
    return {};
  }
}

function persistCustomOverrides(overrides: Record<string, string>): void {
  imagesMutatedInSession = true;
  const clean = stripDefaultMenuImages(overrides);
  memoryCustomImages = clean;

  if (Object.keys(clean).length === 0) {
    void deleteMediaFromIdb(IDB_MENU_IMAGES_KEY);
  } else {
    void writeMediaToIdb(IDB_MENU_IMAGES_KEY, clean);
  }

  try {
    if (Object.keys(clean).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      const json = JSON.stringify(clean);
      if (json.length <= 1_500_000) {
        localStorage.setItem(STORAGE_KEY, json);
      } else {
        // Store exclusively in IndexedDB + memory so localStorage keeps space for reports
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  } catch {
    // QuotaExceededError in localStorage is non-fatal: memory + IndexedDB persist all images
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  }
}

/**
 * Hydrates custom menu images and company logo from IndexedDB into memory.
 */
export async function hydrateCustomMediaCache(): Promise<boolean> {
  let updated = false;
  try {
    const idbImages = await readMediaFromIdb<Record<string, unknown>>(IDB_MENU_IMAGES_KEY);
    const current = loadCustomOverridesSync();
    if (!imagesMutatedInSession && idbImages && typeof idbImages === 'object') {
      const cleanIdb = stripDefaultMenuImages(idbImages);
      if (Object.keys(cleanIdb).length > 0) {
        const merged = { ...cleanIdb, ...current };
        if (JSON.stringify(merged) !== JSON.stringify(current)) {
          memoryCustomImages = merged;
          updated = true;
        }
        if (Object.keys(current).length > 0 && JSON.stringify(merged) !== JSON.stringify(cleanIdb)) {
          await writeMediaToIdb(IDB_MENU_IMAGES_KEY, merged);
        }
      }
    } else if (Object.keys(current).length > 0) {
      await writeMediaToIdb(IDB_MENU_IMAGES_KEY, current);
    }

    // If legacy localStorage still holds an oversized image payload (> 1.5 MB), free it now that IDB has it
    try {
      const rawLs = localStorage.getItem(STORAGE_KEY);
      if (rawLs && rawLs.length > 1_500_000) {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  } catch {
    // Ignore IDB errors
  }

  try {
    const logoUpdated = await hydrateCompanyLogo();
    if (logoUpdated) updated = true;
  } catch {
    // Ignore IDB errors
  }

  return updated;
}

/**
 * Returns only user-customized menu images (excluding built-in defaults)
 */
export function getCustomMenuOverridesOnly(): Record<string, string> {
  return loadCustomOverridesSync();
}

/**
 * Replaces stored custom menu image overrides safely (never throws QuotaExceededError)
 */
export function setCustomMenuImagesMap(map: Record<string, string>): void {
  persistCustomOverrides(map);
}

/**
 * Retrieves all stored custom images or fallbacks to defaults
 */
export function getCustomMenuImages(): Record<string, string> {
  try {
    const custom = loadCustomOverridesSync();
    const result: Record<string, string> = {};

    MENU_ITEMS_CATALOG.forEach((item) => {
      result[item.key] = custom[item.key] || item.defaultImage;
    });

    return result;
  } catch {
    return getDefaultImageMap();
  }
}

/**
 * Retrieves a single custom image for a menu key
 */
export function getMenuImage(key: string): string {
  try {
    const all = getCustomMenuImages();
    if (all[key]) return all[key];
    const catalogItem = MENU_ITEMS_CATALOG.find((c) => c.key === key);
    return catalogItem ? catalogItem.defaultImage : DEFAULT_BARN_ILLUSTRATION;
  } catch {
    return DEFAULT_BARN_ILLUSTRATION;
  }
}

/**
 * Saves a custom image for a menu key
 */
export function saveMenuImage(key: string, dataUrl: string): void {
  try {
    const custom = loadCustomOverridesSync();
    custom[key] = dataUrl;
    persistCustomOverrides(custom);
  } catch (e) {
    console.error('Error saving custom menu image:', e);
  }
}

/**
 * Resets a single image to its default
 */
export function resetMenuImage(key: string): void {
  try {
    const custom = loadCustomOverridesSync();
    delete custom[key];
    persistCustomOverrides(custom);
  } catch (e) {
    console.error('Error resetting custom menu image:', e);
  }
}

/**
 * Resets all menu images to system defaults
 */
export function resetAllMenuImages(): void {
  persistCustomOverrides({});
}

/**
 * Exports all custom menu images and company logo as a downloadable JSON string
 */
export function exportCustomizationPackage(): string {
  try {
    const menuImages = getCustomMenuOverridesOnly();
    const companyLogo = getCompanyLogo();
    return JSON.stringify(
      {
        version: 1,
        timestamp: new Date().toISOString(),
        companyLogo,
        menuImages,
      },
      null,
      2
    );
  } catch (e) {
    console.error('Error exporting customization package:', e);
    return '{}';
  }
}

/**
 * Imports a customization package JSON string
 */
export function importCustomizationPackage(jsonString: string): { success: boolean; count: number; error?: string } {
  try {
    const pkg = JSON.parse(jsonString);
    if (!pkg || typeof pkg !== 'object') {
      return { success: false, count: 0, error: 'Formato de archivo inválido.' };
    }

    let count = 0;
    if (pkg.companyLogo && typeof pkg.companyLogo === 'string' && pkg.companyLogo.startsWith('data:image/')) {
      saveCompanyLogo(pkg.companyLogo);
      count++;
    }

    if (pkg.menuImages && typeof pkg.menuImages === 'object') {
      const existing = getCustomMenuOverridesOnly();
      const merged = stripDefaultMenuImages({ ...existing, ...pkg.menuImages });
      persistCustomOverrides(merged);
      count += Object.keys(stripDefaultMenuImages(pkg.menuImages)).length;
    }

    return { success: true, count };
  } catch (err: any) {
    return { success: false, count: 0, error: err?.message || 'Error al importar configuración.' };
  }
}

/**
 * Reads a File object and converts it to a clean compressed Base64 Data URL
 * optimized for browser storage and Google Sheets cell limits.
 */
export function processUploadedImage(
  file: File,
  maxWidth = 400,
  maxHeight = 350,
  quality = 0.84
): Promise<string> {
  return new Promise((resolve, reject) => {
    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml', 'image/gif', 'image/jpg'];
    if (!validTypes.includes(file.type) && !file.name.match(/\.(jpg|jpeg|png|webp|svg|gif)$/i)) {
      return reject(new Error('Formato no compatible. Por favor suba imágenes en formato PNG, JPG, JPEG, WEBP o SVG.'));
    }

    // Validate size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      return reject(new Error('El archivo supera el tamaño máximo permitido de 5 MB.'));
    }

    const isSvg = file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
    // Keep small SVGs or tiny already-optimized images (< 40 KB) verbatim
    if ((isSvg && file.size <= 160 * 1024) || (file.size <= 40 * 1024 && file.type !== 'image/gif')) {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const rawDataUrl = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width || maxWidth;
        let height = img.height || maxHeight;

        if (width > maxWidth || height > maxHeight) {
          if (width / maxWidth > height / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = Math.max(width, 1);
        canvas.height = Math.max(height, 1);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          return resolve(rawDataUrl);
        }

        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        const isJpeg = file.type === 'image/jpeg' || file.type === 'image/jpg' || /\.(jpg|jpeg)$/i.test(file.name);
        // Prefer WebP for transparent/PNG/GIF/WebP assets (preserves transparency at ~70% smaller size)
        const preferredFormat = isJpeg ? 'image/jpeg' : 'image/webp';

        const encode = (fmt: string, q: number): string => {
          try {
            return canvas.toDataURL(fmt, q);
          } catch {
            return canvas.toDataURL('image/png');
          }
        };

        let result = encode(preferredFormat, quality);
        if (!isJpeg && !result.startsWith('data:image/webp')) {
          result = encode('image/png', quality);
        }

        // Step down quality if payload is still large for Google Sheets sync (keep comfortably under 150 KB)
        if (result.length > 150_000 && (result.startsWith('data:image/webp') || result.startsWith('data:image/jpeg'))) {
          const fmt = result.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg';
          const q2 = encode(fmt, 0.72);
          if (q2.length < result.length) result = q2;
          if (result.length > 150_000) {
            const q3 = encode(fmt, 0.58);
            if (q3.length < result.length) result = q3;
          }
        }

        // If original file was small and re-encoding didn't shrink it, keep smaller representation
        if (rawDataUrl && rawDataUrl.length < result.length && img.width <= maxWidth && img.height <= maxHeight) {
          resolve(rawDataUrl);
          return;
        }

        resolve(result);
      };
      img.onerror = () => reject(new Error('Error al procesar la imagen.'));
      img.src = rawDataUrl;
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo.'));
    reader.readAsDataURL(file);
  });
}
