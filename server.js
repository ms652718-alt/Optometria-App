require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Le decimos al servidor que muestre al público los archivos dentro de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ============================================================================
// ENDPOINT 1: Consultor Clínico (Protegido en el Backend)
// ============================================================================
app.post('/api/analyze', async (req, res) => {
    try {
        // Validación de seguridad inicial
        if (!GEMINI_API_KEY || GEMINI_API_KEY === 'undefined') {
            throw new Error("El servidor no está leyendo la clave API. Revisa tu archivo .env");
        }

        const { lensType, dailyHours, chronicYears, clinicalGoal, clinicalNotes } = req.body;

        const systemPrompt = `Actúa como un software de consultoría clínica experto basado en las pautas de la IACLE y guías de contactología avanzada. Analiza las características del paciente y el objetivo clínico para determinar el tiempo óptimo de suspensión del lente antes de una topografía. Debes responder estrictamente en formato JSON.`;
        
        const userQuery = `Analizar el siguiente caso para topografía corneal basal:
        - Tipo de Lente: ${lensType}
        - Horas de uso al día: ${dailyHours}
        - Años usando lentes de contacto: ${chronicYears}
        - Objetivo del examen: ${clinicalGoal}
        - Notas complementarias: ${clinicalNotes || "Ninguna"}
        
        RETORNA ESTRICTAMENTE UN JSON VÁLIDO CON ESTA ESTRUCTURA EXACTA:
        {
            "nivelRiesgo": "Bajo",
            "diasSuspensionRecomendados": 0,
            "explicacionFisiologica": "texto",
            "afectacionTopografica": "texto",
            "criteriosEstabilidad": "texto",
            "instruccionesPaciente": ["texto1", "texto2"],
            "textoLocucionPacientes": "texto"
        }`;

        // Estructura simplificada a prueba de fallos
        const payload = {
            contents: [{ 
                role: "user",
                parts: [{ text: systemPrompt + "\n\n" + userQuery }] 
            }],
            generationConfig: {
                responseMimeType: "application/json"
            }
        };

        // Usamos el modelo moderno y activo (2.5-flash)
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // NUEVO: Si hay error, leemos el mensaje exacto de Google
        if (!response.ok) {
            const errorBody = await response.text();
            console.error("\n>>> ERROR DE GOOGLE GEMINI <<<");
            console.error(errorBody);
            console.error(">>>>>>>>>>>>><<<<<<<<<<<<<\n");
            throw new Error(`Error de Google ${response.status} (Mira la pantalla negra para más detalles)`);
        }
        
        const result = await response.json();
        const contentText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        res.json({ success: true, data: JSON.parse(contentText) });

    } catch (error) {
        console.error("Error en /api/analyze:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ============================================================================
// ENDPOINT 2: Generador de Voz para Pacientes (Protegido)
// ============================================================================
app.post('/api/tts', async (req, res) => {
    try {
        if (!GEMINI_API_KEY) throw new Error("Falta la clave API en el servidor.");
        
        const { text, voiceName } = req.body;

        const payload = {
            contents: [{ parts: [{ text: `Say clearly and empatic with professional optometrist tone in spanish: ${text}` }] }],
            generationConfig: {
                responseModalities: ["AUDIO"],
                speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } }
            }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorBody = await response.text();
            console.error("Error TTS Gemini:", errorBody);
            throw new Error(`Error en TTS: ${response.status}`);
        }
        
        const result = await response.json();
        res.json({ success: true, data: result });

    } catch (error) {
        console.error("Error en /api/tts:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Servidor Clínico activo en: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});
