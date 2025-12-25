
import { Language } from '../types';

// Dictionnaire de secours (Minimal)
const fallbackDict: Record<string, string> = {
  nav_writer: "Écrivain",
  nav_studio: "Studio",
  nav_lab: "Lab",
  nav_social: "Social",
  btn_generate: "Générer",
  loading: "Chargement..."
};

class I18nService {
  private currentLanguage: Language = 'fr-FR';
  private dictionary: Record<string, string> = {};

  async loadLanguage(lang: Language): Promise<void> {
    this.currentLanguage = lang;
    try {
      // Dans une app réelle, on fetcherait /locales/${lang}.json
      // Ici, on simule le chargement dynamique des dictionnaires structurés
      const response = await fetch(`/locales/${lang}.json`).catch(() => null);
      if (response && response.ok) {
        this.dictionary = await response.json();
      } else {
        // Mocking pour la démo si les fichiers n'existent pas encore physiquement
        this.dictionary = await this.getMockDictionary(lang);
      }
    } catch (e) {
      console.warn(`Could not load dictionary for ${lang}, using fallback.`);
      this.dictionary = fallbackDict;
    }
  }

  t(key: string): string {
    return this.dictionary[key] || fallbackDict[key] || key;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }

  // Simule les fichiers JSON pour la génération
  private async getMockDictionary(lang: Language): Promise<Record<string, string>> {
    const isAfrican = ['ln-CD', 'sw-KE', 'wo-SN', 'yo-NG', 'am-ET'].includes(lang);
    
    return {
      nav_writer: isAfrican ? "Ghostwriter" : "Écrivain",
      nav_studio: "Studio",
      nav_lab: "Lab",
      nav_live: "Live Room",
      nav_intel: "Intelligence",
      nav_social: "Social",
      nav_profile: "Profil",
      nav_settings: "Paramètres",
      btn_go_live: "Go Live",
      studio_title: "Studio Omni",
      studio_desc: "Visual Forge",
      placeholder_search: "Rechercher une langue...",
      welcome_msg: `Bienvenue dans l'écosystème Social Muse.`
    };
  }
}

export const i18n = new I18nService();
