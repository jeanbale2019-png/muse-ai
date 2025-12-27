import { Language } from '../types';

type Dictionary = Record<string, string>;

const LOCALES: Record<string, Dictionary> = {
  'en-US': {
    nav_writer: "Writer",
    nav_studio: "Studio",
    nav_lab: "Lab",
    nav_live: "Live Room",
    nav_intel: "Intelligence",
    nav_social: "Social",
    nav_profile: "Profile",
    nav_settings: "Settings",
    studio_title: "The Ghostwriter's Studio",
    studio_subtitle: "Cast your vision. Analyze the soul of the scene. Write the future.",
    btn_generate: "Generate",
    btn_share: "Share",
    btn_export: "Export",
    btn_save: "Archive Vision",
    btn_refine: "Refine",
    btn_animate: "Animate Narrative Frame",
    btn_consult: "Consult the Muse",
    placeholder_vision: "e.g. 'Add bioluminescent flowers to the scene'...",
    tab_narrative: "Narrative",
    tab_world: "World",
    tab_sensory: "Sensory",
    tab_twists: "Twists",
    loading_vision: "Casting initial vision...",
    loading_alchemy: "Alchemizing pixels...",
    loading_motion: "Weaving motion vectors...",
    voice_persona: "Narrator Persona",
    vault_empty: "The Script Awaits",
    vault_subtitle: "Every masterpiece begins with a single focused vision.",
  },
  'fr-FR': {
    nav_writer: "Écrivain",
    nav_studio: "Studio",
    nav_lab: "Lab",
    nav_live: "Live Room",
    nav_intel: "Intelligence",
    nav_social: "Social",
    nav_profile: "Profil",
    nav_settings: "Paramètres",
    studio_title: "Le Studio du Ghostwriter",
    studio_subtitle: "Projetez votre vision. Analysez l'âme de la scène. Écrivez le futur.",
    btn_generate: "Générer",
    btn_share: "Partager",
    btn_export: "Exporter",
    btn_save: "Archiver la Vision",
    btn_refine: "Affiner",
    btn_animate: "Animer le Cadre Narratif",
    btn_consult: "Consulter la Muse",
    placeholder_vision: "ex: 'Ajouter des fleurs bioluminescentes'...",
    tab_narrative: "Narratif",
    tab_world: "Monde",
    tab_sensory: "Sensoriel",
    tab_twists: "Intrigues",
    loading_vision: "Projection de la vision initiale...",
    loading_alchemy: "Alchimie des pixels...",
    loading_motion: "Tissage des vecteurs de mouvement...",
    voice_persona: "Persona du Narrateur",
    vault_empty: "Le Script Attend",
    vault_subtitle: "Chaque chef-d'œuvre commence par une vision unique.",
  },
  'es-ES': {
    nav_writer: "Escritor",
    nav_studio: "Estudio",
    nav_lab: "Lab",
    nav_live: "Sala en Vivo",
    nav_intel: "Inteligencia",
    nav_social: "Social",
    nav_profile: "Perfil",
    nav_settings: "Ajustes",
    studio_title: "El Estudio del Ghostwriter",
    studio_subtitle: "Lanza tu visión. Analiza el alma de la escena. Escribe el futuro.",
    btn_generate: "Generar",
    btn_share: "Compartir",
    btn_export: "Exportar",
    btn_save: "Archivar Visión",
    btn_refine: "Refinar",
    btn_animate: "Animar Marco Narrativo",
    btn_consult: "Consultar a la Muse",
    placeholder_vision: "ej: 'Añadir flores bioluminiscentes'...",
    tab_narrative: "Narrativa",
    tab_world: "Mundo",
    tab_sensory: "Sensorial",
    tab_twists: "Giros",
    loading_vision: "Lanzando visión inicial...",
    loading_alchemy: "Alquimizando píxeles...",
    loading_motion: "Tejiendo vectores de movimiento...",
    voice_persona: "Persona del Narrador",
    vault_empty: "El Guion Espera",
    vault_subtitle: "Cada obra maestra comienza con una visión única.",
  },
  'de-DE': {
    nav_writer: "Schreiber",
    nav_studio: "Studio",
    nav_lab: "Labor",
    nav_live: "Live-Raum",
    nav_intel: "Intelligenz",
    nav_social: "Sozial",
    nav_profile: "Profil",
    nav_settings: "Einstellungen",
    studio_title: "Das Ghostwriter-Studio",
    studio_subtitle: "Projizieren Sie Ihre Vision. Analysieren Sie die Seele der Szene. Schreiben Sie die Zukunft.",
    btn_generate: "Generieren",
    btn_share: "Teilen",
    btn_export: "Exportieren",
    btn_save: "Vision archivieren",
    btn_refine: "Verfeinern",
    btn_animate: "Narrativen Rahmen animieren",
    btn_consult: "Die Muse konsultieren",
    placeholder_vision: "z.B. 'Biolumineszierende Blumen hinzufügen'...",
    tab_narrative: "Erzählung",
    tab_world: "Welt",
    tab_sensory: "Sensorisch",
    tab_twists: "Wendungen",
    loading_vision: "Vision wird projiziert...",
    loading_alchemy: "Pixel-Alchemie läuft...",
    loading_motion: "Bewegungsvektoren werden gewebt...",
    voice_persona: "Erzähler-Persona",
    vault_empty: "Das Skript wartet",
    vault_subtitle: "Jedes Meisterwerk beginnt mit einer einzigen, fokussierten Vision.",
  }
};

class I18nService {
  private currentLanguage: Language = 'en-US';
  private dictionary: Dictionary = LOCALES['en-US'];

  async loadLanguage(lang: Language): Promise<void> {
    this.currentLanguage = lang;
    // Attempt to load from internal LOCALES, fallback to English if not found
    this.dictionary = LOCALES[lang] || LOCALES['en-US'];
    
    // In a real app, you might also fetch remote JSONs here
    console.debug(`Language switched to ${lang}`);
  }

  t(key: string): string {
    const val = this.dictionary[key];
    if (val) return val;
    
    // Fallback to English if key is missing in current dict
    return LOCALES['en-US'][key] || key;
  }

  getCurrentLanguage() {
    return this.currentLanguage;
  }
}

export const i18n = new I18nService();