---
name: video-producer
description: Produce Hollywood-quality corporate videos from natural language descriptions. Full pipeline: script → voiceover (ElevenLabs) → keyframe images (Seedream V4) → video animation (Kling V2.1 Pro) → assembly (ffmpeg). Keywords: video, producir video, crear video, generar video, cinematic, corporativo, kickoff, anuncio, comunicación, producción audiovisual.
user-invocable: true
---

# Video Producer — Cinematic AI Video Production

Follow these steps exactly to produce a Hollywood-quality corporate video from a natural language description.

## Reference: Production Principles

Before starting, internalize these principles — they guide ALL production decisions.

### Quality Standards

- **NEVER generate video directly from text prompts.** Always use the two-step pipeline: generate photorealistic keyframe image FIRST, then animate with image-to-video.
- **NEVER apply audio filters to ElevenLabs output.** The original audio is already high quality. No echo, reverb, noise reduction, or normalization.
- **ALWAYS use Spain Spanish (español peninsular)** for voiceovers. Never Latin American Spanish unless explicitly requested.
- **ALWAYS use photography-specific language** in image prompts: camera model, lens type, focal length, aperture, lighting conditions.

### Tool Stack

| Component | Tool | Model/Voice |
|-----------|------|-------------|
| **Voiceover** | ElevenLabs | Sara Martin 3 (`gD1IexrzCvsXPHUuT0s3`) — peninsular, conversational |
| **Keyframe images** | Higgsfield | Seedream V4 (`bytedance/seedream/v4/text-to-image`) |
| **Video animation** | Higgsfield | Kling V2.1 Pro (`kling-video/v2.1/pro/image-to-video`) |
| **Assembly** | ffmpeg | H.264 CRF18 + AAC 256kbps |

### Alternative Voices (Spain Spanish)

| Voice | ID | Gender | Style |
|-------|-----|--------|-------|
| Sara Martin 3 | `gD1IexrzCvsXPHUuT0s3` | Female | Upbeat, conversational |
| Alejandra | `kwNLkNjbQHMw9YUFZsHI` | Female | Casual, peninsular |

### Image Prompt Formula

Every image prompt MUST follow this structure:

```
[Scene description in detail]. [Camera/lens: "Shot on {CAMERA} with {LENS} at {APERTURE}"]. [Lighting: "golden hour / studio Rembrandt / natural window light"]. [Style: "Cinematic color grading. Shallow depth of field. Film grain."]. 8K photorealistic.
```

**Camera references to use:**
- Establishing shots: ARRI Alexa Mini LF + Cooke Anamorphic 40mm
- Close-ups: Canon RF 85mm f/1.2 or Sony 85mm f/1.4 GM
- Medium shots: Sony FX6 + Sigma 35mm Art f/1.4
- Slow motion: Phantom Flex at 120fps + Panavision C-Series Anamorphic
- Product/screen shots: Canon EOS R5 + 50mm f/1.2

### Video Animation Prompt Formula

Every video prompt should describe MOTION, not static description:

```
[Subject action]. [Camera movement: "slowly pushes in / dollies forward / orbits"]. [Secondary motion: "light shifts / particles float / hair moves"]. [Quality: "Photorealistic movement. Natural pacing."]
```

### Assembly Rules

1. Each voiceover is placed at its exact timestamp using ffmpeg `adelay`
2. All VOs mixed with `amix normalize=0` (preserves original quality)
3. Video and audio merged in ONE single pass: `ffmpeg -c:v copy -c:a aac -b:a 256k`
4. Always use `-movflags +faststart` for web-friendly output
5. Video resolution: 1280x720 minimum, scaled with `pad` to avoid distortion

---

## Step 1 — Authentication

Check if credentials exist at `~/.fyso/config.json` for the Fyso token, and check for API keys:

**Required API keys:**
- `ELEVEN_API_KEY` — ElevenLabs (voiceover)
- `HF_KEY` — Higgsfield (format: `api_key:api_secret`)

Check `~/.video-producer/config.json` for saved keys. If it exists, read and use stored values.

If no saved config exists, ask the user for each missing key:

> Para ElevenLabs, obtén tu API key en https://elevenlabs.io/app/settings/api-keys
> Para Higgsfield, obtén tu API key y secret en https://cloud.higgsfield.ai/api-keys (formato: key:secret)

Save to `~/.video-producer/config.json`:

```json
{
  "eleven_api_key": "{KEY}",
  "hf_key": "{KEY}:{SECRET}",
  "default_voice_id": "gD1IexrzCvsXPHUuT0s3",
  "default_voice_name": "Sara Martin 3",
  "default_language": "es-ES",
  "saved_at": "{ISO_TIMESTAMP}"
}
```

Validate ElevenLabs by listing voices. Validate Higgsfield by calling `bytedance/seedream/v4/text-to-image` with a simple test prompt.

## Step 2 — Requirements Gathering

Ask the user:

> ¿Qué video necesitas producir? Descríbelo en lenguaje natural. Incluye:
> - **Objetivo**: ¿Para qué es el video? (kickoff, anuncio, tutorial, producto, etc.)
> - **Audiencia**: ¿Quién lo va a ver? (equipo interno, clientes, público general)
> - **Duración aproximada**: ¿Cuántos minutos? (recomendado: 2-4 min)
> - **Tono**: ¿Inspiracional, informativo, urgente, celebratorio?
> - **Elementos clave**: ¿Qué DEBE aparecer en el video?

Wait for response. If description is vague, ask up to 2 clarifying questions.

## Step 3 — Script Writing

Write a complete video script with this structure:

```markdown
# [Video Title]

**Duración estimada:** X:XX minutos
**Audiencia:** [target]
**Tono:** [tone]

## SECTION 1: [Section Name]

### [Timestamp] Scene Title

**[VISUAL CUES]** — describe what the viewer sees

**VOZ EN OFF:**
> Script text in Spanish (Spain)

---
```

**Rules for the script:**
- Write all narration in Spanish (Spain) — use "vosotros", "habéis", natural peninsular expressions
- Each scene should have: visual cues + voiceover text OR visual-only moment
- Include timing markers: `[00:00 - 00:06]`
- Keep total video between 2-4 minutes unless specified otherwise
- Include at least one visual-only dramatic moment (no voiceover) for emotional impact

Present the script to the user for approval. Iterate until approved.

## Step 4 — Shot List Design

From the approved script, create a shot list. Each shot has:

```python
{
    "id": "shot_XX",
    "name": "Short description",
    "image_prompt": "Full photorealistic image prompt following the formula",
    "video_prompt": "Motion description for image-to-video",
    "voiceover": "vo_XX" or None,
}
```

**Guidelines:**
- 2-3 shots per voiceover section (cut between them for visual rhythm)
- 1 shot for silent/dramatic moments
- Total shots: typically 15-25 for a 2-4 minute video
- Vary shot types: establishing, close-up, medium, abstract visualization, screen/UI

Also create a timeline mapping sections to shots:

```python
SECTIONS = [
    {"name": "section_name", "shots": ["shot_01", "shot_02"], "vo": "vo_01"},
    {"name": "visual_break", "shots": ["shot_03"], "vo": None, "fixed_dur": 5.0},
]
```

## Step 5 — Production Setup

Ensure the production directory structure exists:

```
{project}/production/
  audio/          # Voiceover MP3 files
  images_hq/      # Keyframe PNG images (Seedream V4)
  video_hq/       # Animated MP4 clips (Kling V2.1 Pro)
  temp/           # Assembly temp files
```

Install required packages if not present:

```bash
pip install --user higgsfield-client elevenlabs
```

Verify ffmpeg is available:

```bash
ffmpeg -version
```

## Step 6 — Generate Voiceovers

For each voiceover section, generate audio with ElevenLabs:

```python
from elevenlabs.client import ElevenLabs

client = ElevenLabs(api_key=ELEVEN_API_KEY)
audio = client.text_to_speech.convert(
    text=vo_text,
    voice_id="gD1IexrzCvsXPHUuT0s3",  # Sara Martin 3
    model_id="eleven_v3",
    output_format="mp3_44100_128",
)
audio_bytes = b''.join(audio)
```

Save each to `production/audio/vo_XX.mp3`.

**IMPORTANT:** Do NOT apply any audio processing. Save the raw output directly.

## Step 7 — Generate Keyframe Images

For each shot, generate a photorealistic keyframe with Seedream V4 via Higgsfield:

```python
import higgsfield_client

result = higgsfield_client.subscribe(
    'bytedance/seedream/v4/text-to-image',
    arguments={
        'prompt': shot['image_prompt'],
        'aspect_ratio': '16:9',
    }
)
image_url = result['images'][0]['url']
```

Download and save each to `production/images_hq/shot_XX.png`.

**Fallback:** If Seedream is unavailable, use Nano Banana Pro via Gemini API:

```python
from google import genai
from google.genai import types

client = genai.Client(api_key=GEMINI_API_KEY)
response = client.models.generate_content(
    model='gemini-2.5-flash-image',
    contents=f'Generate an image: {shot["image_prompt"]}',
    config=types.GenerateContentConfig(
        response_modalities=['TEXT', 'IMAGE'],
    )
)
```

## Step 8 — Generate Videos (Image-to-Video)

For each keyframe, animate it with Kling V2.1 Pro via Higgsfield:

```python
import higgsfield_client

# Upload the keyframe image
image_url = higgsfield_client.upload_file(str(image_path))

result = higgsfield_client.subscribe(
    'kling-video/v2.1/pro/image-to-video',
    arguments={
        'image_url': image_url,
        'prompt': shot['video_prompt'],
    }
)
video_url = result['video']['url']
```

Download and save each to `production/video_hq/shot_XX.mp4`.

**Note:** Each clip takes ~2 minutes to generate. For 20 shots, expect ~40 minutes total.

## Step 9 — Assemble Final Video

Assembly follows a strict 4-step process:

### 9a. Build video track

For each timeline section, concatenate+trim the section's video clips to match voiceover duration:

```bash
# Create concat list with enough loops to cover duration
ffmpeg -f concat -safe 0 -i section_list.txt \
  -t {duration} \
  -vf "scale=1280:720:force_original_aspect_ratio=decrease,pad=1280:720:(ow-iw)/2:(oh-ih)/2:black,fps=30,format=yuv420p" \
  -an -c:v libx264 -preset medium -crf 18 \
  chunk_XX.mp4
```

Then concatenate all chunks:

```bash
ffmpeg -f concat -safe 0 -i final_list.txt -c:v copy video_only.mp4
```

### 9b. Build audio track

Place each voiceover at its correct timestamp:

```bash
ffmpeg -i vo_XX.mp3 \
  -af "adelay={start_ms}|{start_ms},apad=whole_dur={total_dur}" \
  -ar 44100 -ac 2 -c:a pcm_s16le \
  padded_vo_XX.wav
```

Mix all padded VOs into one track:

```bash
ffmpeg -i pad_01.wav -i pad_02.wav ... \
  -filter_complex "[0][1]...amix=inputs=N:duration=longest:normalize=0[aout]" \
  -map "[aout]" audio_final.wav
```

### 9c. Final merge

```bash
ffmpeg -i video_only.mp4 -i audio_final.wav \
  -c:v copy -c:a aac -b:a 256k \
  -map 0:v:0 -map 1:a:0 \
  -shortest -movflags +faststart \
  output_final.mp4
```

## Step 10 — Deliver and Report

Present the final video to the user:

---

**Video producido exitosamente**

- **Archivo:** `{output_path}`
- **Duración:** X:XX minutos
- **Tamaño:** XX MB
- **Resolución:** 1280x720 H.264 + AAC 256kbps
- **Voiceover:** Sara Martin 3 (español peninsular)
- **Imágenes:** Seedream V4 (Higgsfield)
- **Video:** Kling V2.1 Pro (Higgsfield)

**Assets generados:**
- `production/audio/` — X voiceovers
- `production/images_hq/` — X keyframes
- `production/video_hq/` — X clips animados

---

Open the video for the user with `open {output_path}`.

Ask if they want adjustments:
- Regenerar shots específicos
- Cambiar el timing de alguna sección
- Ajustar la voz o el tono
- Agregar música de fondo

## Appendix: Troubleshooting

### Voice errors
- `voice_not_fine_tuned`: The voice cannot be used with eleven_v3. Switch to Sara Martin 3 or Alejandra.
- Accent mixing: Check that `voice_id` is a peninsular voice AND `model_id` is `eleven_v3`.

### Higgsfield errors
- `Model not found`: Use exact paths: `bytedance/seedream/v4/text-to-image` and `kling-video/v2.1/pro/image-to-video`
- `Invalid credentials`: HF_KEY must be in `key:secret` format
- Upload fails: Try using a public URL instead of uploading the file

### ffmpeg assembly noise
- NEVER apply audio filters (highpass, lowpass, afftdn, aecho, loudnorm)
- Use `amix normalize=0` to prevent level changes
- Use `pcm_s16le` as intermediate format (lossless)
- Encode to AAC only in the final merge step

### Rate limits
- ElevenLabs: ~10k chars/month on free tier. Upgrade for production.
- Higgsfield: Credit-based. Basic plan = 150 credits/month. Each image ~1 credit, each video ~15-25 credits.
- If Higgsfield quota runs out: fall back to Nano Banana (Gemini API) for images + MiniMax for video (lower quality).
