'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const YOUDAO_AUDIO_URL = 'https://dict.youdao.com/dictvoice';

export function useWordAudio() {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [playingWord, setPlayingWord] = useState<string | null>(null);

    const stopCurrentAudio = useCallback(() => {
        if (!audioRef.current) {
            return;
        }

        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current = null;
        setPlayingWord(null);
    }, []);

    const play = useCallback((word: string) => {
        const normalizedWord = word.trim();
        if (!normalizedWord) {
            return;
        }

        stopCurrentAudio();

        const url = `${YOUDAO_AUDIO_URL}?audio=${encodeURIComponent(normalizedWord)}&type=0`;
        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingWord(normalizedWord);

        const resetState = () => {
            if (audioRef.current === audio) {
                audioRef.current = null;
                setPlayingWord(null);
            }
        };

        audio.addEventListener('ended', resetState, { once: true });
        audio.addEventListener('error', resetState, { once: true });

        audio.play().catch(() => {
            resetState();
        });
    }, [stopCurrentAudio]);

    useEffect(() => {
        return () => {
            stopCurrentAudio();
        };
    }, [stopCurrentAudio]);

    return {
        play,
        playingWord,
    };
}
