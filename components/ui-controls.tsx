'use client';
import { Languages, Moon, Sun } from 'lucide-react';
import { useUi } from './ui-provider';
import { playThemeSwitch } from './theme-bulb';
export function UiControls() {
  const { locale, dark, t, setLocale, setTheme } = useUi();
  return (
    <div className="ui-controls">
      <button
        type="button"
        className="control-button language-control"
        aria-label={t('สลับภาษาเป็นอังกฤษ', 'Switch language to Thai')}
        onClick={() => setLocale(locale === 'th' ? 'en' : 'th')}
      >
        <Languages size={18} />
        <span>{locale === 'th' ? 'EN' : 'ไทย'}</span>
      </button>
      <button
        type="button"
        className="control-button"
        aria-label={dark ? t('ใช้ธีมสว่าง', 'Use light theme') : t('ใช้ธีมมืด', 'Use dark theme')}
        onClick={(e) => {
          const next = dark ? 'light' : 'dark';
          playThemeSwitch(e.currentTarget, next === 'dark', () => setTheme(next));
        }}
      >
        {dark ? <Sun size={19} /> : <Moon size={19} />}
      </button>
    </div>
  );
}
