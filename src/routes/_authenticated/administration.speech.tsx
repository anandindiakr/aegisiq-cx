import { createFileRoute } from "@tanstack/react-router";

import { SettingsForm } from "@/components/administration/SettingsForm";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/administration/speech")({
  component: SpeechSettingsPage,
});

function SpeechSettingsPage() {
  return (
    <Tabs defaultValue="speech">
      <TabsList className="bg-surface">
        <TabsTrigger value="speech">Speech pipeline</TabsTrigger>
        <TabsTrigger value="voice">Voice commands</TabsTrigger>
      </TabsList>

      <TabsContent value="speech" className="mt-4">
        <SettingsForm
          section="speech"
          groups={[
            {
              title: "Transcription provider",
              description: "Speech-to-text route used by ingestion and ConversationIQ™",
              fields: [
                {
                  key: "provider",
                  label: "Speech provider",
                  type: "select",
                  options: [
                    { value: "whisper", label: "Whisper" },
                    { value: "deepgram", label: "Deepgram" },
                    { value: "azure_speech", label: "Azure Speech" },
                    { value: "google", label: "Google Speech-to-Text" },
                    { value: "assemblyai", label: "AssemblyAI" },
                  ],
                },
                {
                  key: "sampling_rate",
                  label: "Sampling rate (Hz)",
                  type: "select",
                  options: [
                    { value: "8000", label: "8 kHz — telephony" },
                    { value: "16000", label: "16 kHz — broadcast standard" },
                    { value: "24000", label: "24 kHz" },
                    { value: "48000", label: "48 kHz — studio" },
                  ],
                },
                {
                  key: "language_priority",
                  label: "Language priority",
                  type: "text",
                  hint: "Comma-separated ISO codes tried in order, e.g. en,zh,ms,ta",
                  full: true,
                },
              ],
            },
            {
              title: "Signal processing",
              description: "Applied before transcription to protect accuracy in noisy retail floors",
              fields: [
                { key: "diarization", label: "Speaker diarization", type: "switch" },
                { key: "max_speakers", label: "Max speakers", type: "number", min: 2, max: 12 },
                { key: "noise_reduction", label: "Noise reduction", type: "switch" },
                { key: "vad", label: "Voice activity detection", type: "switch" },
                {
                  key: "vad_sensitivity",
                  label: "VAD sensitivity",
                  type: "slider",
                  min: 0,
                  max: 1,
                  step: 0.05,
                },
                {
                  key: "auto_translation",
                  label: "Auto translation",
                  type: "switch",
                  hint: "Translate non-default languages into the workspace language",
                },
                { key: "profanity_filter", label: "Profanity masking", type: "switch" },
              ],
            },
          ]}
        />
      </TabsContent>

      <TabsContent value="voice" className="mt-4">
        <SettingsForm
          section="voice"
          groups={[
            {
              title: "Voice command settings",
              description: "Controls how Aegis Copilot™ listens and responds hands-free",
              fields: [
                { key: "wake_phrase", label: "Wake phrase", type: "text" },
                {
                  key: "speech_language",
                  label: "Speech language",
                  type: "select",
                  options: [
                    { value: "en-US", label: "English (US)" },
                    { value: "en-GB", label: "English (UK)" },
                    { value: "zh-CN", label: "Chinese (Mandarin)" },
                    { value: "ms-MY", label: "Malay" },
                    { value: "ta-IN", label: "Tamil" },
                    { value: "tl-PH", label: "Tagalog" },
                  ],
                },
                { key: "voice_output", label: "Spoken responses", type: "switch" },
                {
                  key: "auto_listen",
                  label: "Auto listen",
                  type: "switch",
                  hint: "Re-open the microphone after each spoken answer",
                },
                {
                  key: "voice_timeout",
                  label: "Voice timeout (seconds)",
                  type: "number",
                  min: 3,
                  max: 60,
                },
                {
                  key: "voice_response",
                  label: "Response style",
                  type: "select",
                  options: [
                    { value: "concise", label: "Concise" },
                    { value: "detailed", label: "Detailed" },
                    { value: "executive", label: "Executive briefing" },
                  ],
                },
              ],
            },
          ]}
        />
      </TabsContent>
    </Tabs>
  );
}
