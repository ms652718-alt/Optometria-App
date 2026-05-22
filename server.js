require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();

app.use(cors());
app.use(express.json());

// Le decimos al servidor que muestre al público los archivos dentro de la carpeta 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Definimos el puerto (3000 por defecto) y cargamos tu clave oculta
const PORT = process.env.PORT || 3000;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// ============================================================================
// ENDPOINT 1: Consultor Clínico (Protegido en el Backend)
// ============================================================================
app.post('/api/analyze', async (req, res) => {
    try {
        // 1. Recibimos los datos que el usuario eligió en la pantalla
        const { lensType, dailyHours, chronicYears, clinicalGoal, clinicalNotes } = req.body;

        // 2. Construimos el Prompt Clínico (¡Esto queda oculto para los usuarios!)
        const systemPrompt = `Actúa como un software de consultoría clínica experto basado en las pautas de la IACLE y guías de contactología avanzada. Analiza las características del paciente y el objetivo clínico para determinar el tiempo óptimo de suspensión del lente antes de una topografía. Debes responder estrictamente en formato JSON utilizando el esquema proporcionado. El análisis debe ser riguroso y los tiempos coherentes con el grado de deformación (fisiológica y mecánica).`;
        
        const userQuery = `Analizar el siguiente caso para topografía corneal basal:
        - Tipo de Lente: ${lensType}
        - Horas de uso al día: ${dailyHours}
        - Años usando lentes de contacto: ${chronicYears}
        - Objetivo del examen: ${clinicalGoal}
        - Notas complementarias: ${clinicalNotes || "Ninguna"}`;

        // 3. Preparamos el paquete para Gemini (incluyendo la estructura JSON estricta)
        const payload = {
            contents: [{ parts: [{ text: userQuery }] }],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        nivelRiesgo: { type: "STRING" },
                        diasSuspensionRecomendados: { type: "NUMBER" },
                        explicacionFisiologica: { type: "STRING" },
                        afectacionTopografica: { type: "STRING" },
                        criteriosEstabilidad: { type: "STRING" },
                        instruccionesPaciente: { type: "ARRAY", items: { type: "STRING" } },
                        textoLocucionPacientes: { type: "STRING" }
                    },
                    required: ["nivelRiesgo", "diasSuspensionRecomendados", "explicacionFisiologica", "afectacionTopografica", "criteriosEstabilidad", "instruccionesPaciente", "textoLocucionPacientes"]
                }
            },
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

        // 4. Enviamos la petición a Google
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error(`Error en la API de IA: ${response.status}`);
        
        const result = await response.json();
        const contentText = result?.candidates?.[0]?.content?.parts?.[0]?.text;
        
        // 5. Devolvemos la respuesta procesada a nuestra página web
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

        if (!response.ok) throw new Error(`Error en TTS: ${response.status}`);
        
        const result = await response.json();
        res.json({ success: true, data: result });

    } catch (error) {
        console.error("Error en /api/tts:", error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Iniciamos el servidor
app.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(`✅ Servidor Clínico activo en: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
});