// src/lib/whatsapp-sounds.ts
// Web Audio API-based notification sounds for the WhatsApp admin panel.
// All sounds are generated programmatically to avoid copyright issues.

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new AudioContext();
    }
    return audioContext;
}

/**
 * Plays a two-tone incoming sound when a client message arrives in the
 * currently-open conversation.
 */
export function playIncomingSound(): void {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(800, ctx.currentTime);
        osc.frequency.setValueAtTime(1000, ctx.currentTime + 0.1);
        osc.type = "sine";

        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.3);
    } catch {
        // Silently fail if audio is not supported or blocked by the browser.
    }
}

/**
 * Plays a short outgoing sound when a message is sent by the admin or bot.
 */
export function playOutgoingSound(): void {
    try {
        const ctx = getAudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.frequency.setValueAtTime(600, ctx.currentTime);
        osc.type = "sine";

        gain.gain.setValueAtTime(0.15, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);

        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + 0.15);
    } catch {
        // Silently fail.
    }
}

/**
 * Plays a two-tone notification sound when a message arrives in a background
 * (not currently selected) conversation.
 */
export function playNotificationSound(): void {
    try {
        const ctx = getAudioContext();

        const osc1 = ctx.createOscillator();
        const osc2 = ctx.createOscillator();
        const gain = ctx.createGain();

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(ctx.destination);

        osc1.frequency.setValueAtTime(880, ctx.currentTime);
        osc1.type = "sine";
        osc2.frequency.setValueAtTime(1320, ctx.currentTime + 0.15);
        osc2.type = "sine";

        gain.gain.setValueAtTime(0.2, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

        osc1.start(ctx.currentTime);
        osc1.stop(ctx.currentTime + 0.15);
        osc2.start(ctx.currentTime + 0.15);
        osc2.stop(ctx.currentTime + 0.4);
    } catch {
        // Silently fail.
    }
}
