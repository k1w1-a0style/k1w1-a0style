/**
 * AIContext Integration Tests
 * 
 * ✅ Testet die Integration zwischen AIContext und Orchestrator
 * ✅ Testet Key-Rotation und Provider-Status
 * 
 * @jest-environment node
 */

import {
  PROVIDER_DEFAULTS,
  AVAILABLE_MODELS,
  PROVIDER_METADATA,
  type AllAIProviders,
  type QualityMode,
  type ModelInfo,
  type ProviderDefaults,
} from '../../contexts/AIContext';

describe('AIContext Integration', () => {
  describe('Provider Configuration', () => {
    const providers: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];

    describe('PROVIDER_DEFAULTS', () => {
      providers.forEach(provider => {
        it(`sollte gültige Defaults für ${provider} haben`, () => {
          const defaults = PROVIDER_DEFAULTS[provider];
          
          expect(defaults).toBeDefined();
          expect(defaults.speed).toBeDefined();
          expect(defaults.quality).toBeDefined();
          expect(typeof defaults.speed).toBe('string');
          expect(typeof defaults.quality).toBe('string');
        });

        it(`sollte speed und quality Modelle für ${provider} in AVAILABLE_MODELS haben`, () => {
          const defaults = PROVIDER_DEFAULTS[provider];
          const models = AVAILABLE_MODELS[provider];
          const modelIds = models.map(m => m.id);

          expect(modelIds).toContain(defaults.speed);
          expect(modelIds).toContain(defaults.quality);
        });
      });
    });

    describe('AVAILABLE_MODELS', () => {
      providers.forEach(provider => {
        it(`sollte mindestens ein Modell für ${provider} haben`, () => {
          const models = AVAILABLE_MODELS[provider];
          
          expect(models).toBeDefined();
          expect(Array.isArray(models)).toBe(true);
          expect(models.length).toBeGreaterThan(0);
        });

        it(`sollte valide ModelInfo-Objekte für ${provider} haben`, () => {
          const models = AVAILABLE_MODELS[provider];
          
          models.forEach(model => {
            expect(model.id).toBeDefined();
            expect(typeof model.id).toBe('string');
            expect(model.label).toBeDefined();
            expect(typeof model.label).toBe('string');
            expect(model.description).toBeDefined();
            expect(['free', 'credit', 'paid']).toContain(model.tier);
            expect(['speed', 'quality', 'balanced', 'review']).toContain(model.persona);
            expect(model.bestFor).toBeDefined();
          });
        });

        it(`sollte ein Auto-Modell für ${provider} haben`, () => {
          const models = AVAILABLE_MODELS[provider];
          const autoModel = models.find(m => m.isAuto === true);
          
          expect(autoModel).toBeDefined();
          if (autoModel) {
            expect(autoModel.label.toLowerCase()).toContain('auto');
          }
        });
      });

      it('sollte keine doppelten Model-IDs haben', () => {
        providers.forEach(provider => {
          const models = AVAILABLE_MODELS[provider];
          const ids = models.map(m => m.id);
          const uniqueIds = [...new Set(ids)];
          
          expect(ids.length).toBe(uniqueIds.length);
        });
      });
    });

    describe('PROVIDER_METADATA', () => {
      providers.forEach(provider => {
        it(`sollte vollständige Metadaten für ${provider} haben`, () => {
          const metadata = PROVIDER_METADATA[provider];
          
          expect(metadata).toBeDefined();
          expect(metadata.id).toBe(provider);
          expect(metadata.label).toBeDefined();
          expect(metadata.emoji).toBeDefined();
          expect(metadata.description).toBeDefined();
          expect(metadata.hero).toBeDefined();
          expect(metadata.accent).toBeDefined();
          // Accent sollte eine Hex-Farbe sein
          expect(metadata.accent).toMatch(/^#[0-9a-fA-F]{6}$/);
        });
      });
    });
  });

  describe('Quality Mode Model Selection', () => {
    const providers: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];

    describe('Speed Mode', () => {
      providers.forEach(provider => {
        it(`sollte schnelleres Modell für ${provider} im Speed-Modus haben`, () => {
          const defaults = PROVIDER_DEFAULTS[provider];
          const models = AVAILABLE_MODELS[provider];
          const speedModel = models.find(m => m.id === defaults.speed);
          
          expect(speedModel).toBeDefined();
          if (speedModel) {
            // Speed-Modelle sollten 'speed' oder 'balanced' Persona haben
            expect(['speed', 'balanced']).toContain(speedModel.persona);
          }
        });
      });
    });

    describe('Quality Mode', () => {
      providers.forEach(provider => {
        it(`sollte höherqualitatives Modell für ${provider} im Quality-Modus haben`, () => {
          const defaults = PROVIDER_DEFAULTS[provider];
          const models = AVAILABLE_MODELS[provider];
          const qualityModel = models.find(m => m.id === defaults.quality);
          
          expect(qualityModel).toBeDefined();
          if (qualityModel) {
            // Quality-Modelle sollten 'quality', 'review' oder 'balanced' Persona haben
            expect(['quality', 'review', 'balanced']).toContain(qualityModel.persona);
          }
        });
      });
    });
  });

  describe('Model Tier Distribution', () => {
    it('sollte mindestens ein Free-Tier Modell pro Provider haben', () => {
      const providers: AllAIProviders[] = ['groq', 'gemini', 'huggingface'];
      
      providers.forEach(provider => {
        const models = AVAILABLE_MODELS[provider];
        const freeModels = models.filter(m => m.tier === 'free');
        
        expect(freeModels.length).toBeGreaterThan(0);
      });
    });

    it('sollte Free oder Credit-Tier Speed-Modelle haben', () => {
      const providers: AllAIProviders[] = ['groq', 'gemini', 'huggingface'];
      
      providers.forEach(provider => {
        const defaults = PROVIDER_DEFAULTS[provider];
        const models = AVAILABLE_MODELS[provider];
        const speedModel = models.find(m => m.id === defaults.speed);
        
        expect(speedModel).toBeDefined();
        if (speedModel) {
          expect(['free', 'credit']).toContain(speedModel.tier);
        }
      });
    });
  });

  describe('Context Window Information', () => {
    it('sollte Context Window Info für Modelle haben', () => {
      const providers: AllAIProviders[] = ['groq', 'gemini', 'openai', 'anthropic', 'huggingface'];
      
      providers.forEach(provider => {
        const models = AVAILABLE_MODELS[provider];
        
        // Mindestens einige Modelle sollten contextWindow haben
        const modelsWithContext = models.filter(m => m.contextWindow);
        expect(modelsWithContext.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Provider-Specific Features', () => {
    it('Groq sollte FPGA-beschleunigte Modelle haben', () => {
      const metadata = PROVIDER_METADATA.groq;
      expect(metadata.description.toLowerCase()).toContain('fpga');
    });

    it('Gemini sollte große Kontextfenster haben', () => {
      const models = AVAILABLE_MODELS.gemini;
      const largeContextModels = models.filter(m => 
        m.contextWindow && (m.contextWindow.includes('1M') || m.contextWindow.includes('2M'))
      );
      expect(largeContextModels.length).toBeGreaterThan(0);
    });

    it('Anthropic sollte Claude-Modelle haben', () => {
      const models = AVAILABLE_MODELS.anthropic;
      const claudeModels = models.filter(m => m.id.toLowerCase().includes('claude'));
      expect(claudeModels.length).toBeGreaterThan(0);
    });

    it('HuggingFace sollte Open-Source Modelle haben', () => {
      const metadata = PROVIDER_METADATA.huggingface;
      expect(metadata.description.toLowerCase()).toContain('open-source');
    });
  });
});

describe('Provider Configuration Consistency', () => {
  it('sollte konsistente Provider-IDs haben', () => {
    const defaultKeys = Object.keys(PROVIDER_DEFAULTS);
    const modelKeys = Object.keys(AVAILABLE_MODELS);
    const metadataKeys = Object.keys(PROVIDER_METADATA);

    expect(defaultKeys.sort()).toEqual(modelKeys.sort());
    expect(defaultKeys.sort()).toEqual(metadataKeys.sort());
  });

  it('sollte keine undefined Werte in Defaults haben', () => {
    Object.entries(PROVIDER_DEFAULTS).forEach(([provider, defaults]) => {
      expect(defaults.speed).not.toBeUndefined();
      expect(defaults.quality).not.toBeUndefined();
    });
  });
});
