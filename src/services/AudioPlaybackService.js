import { reactive } from 'vue';
import MessageService from './MessageService';

const state = reactive({
  currentlyPlaying: null,
  isLoading: false,
});

let audio = null;

const stopCurrentAudio = () => {
  if (audio) {
    audio.pause();
    audio.src = '';
    audio = null;
  }
  state.currentlyPlaying = null;
  state.isLoading = false;
};

const playAudio = (messageId, url) => {
  stopCurrentAudio();
  audio = new Audio(url);
  state.currentlyPlaying = messageId;
  state.isLoading = false;

  audio.play().catch(error => {
    console.error('Error playing audio:', error);
    stopCurrentAudio();
  });

  audio.onended = () => {
    URL.revokeObjectURL(url);
    stopCurrentAudio();
  };
};

export const useAudioPlayback = () => {
  const toggleReadOutLoud = async (messageId) => {
    if (state.currentlyPlaying === messageId) {
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    state.isLoading = true;
    state.currentlyPlaying = messageId; // Set loading state for this message

    try {
      const response = await MessageService.getReadOutLoudAudio(messageId);
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      playAudio(messageId, url);
    } catch (error) {
      console.error('Error fetching or playing audio:', error);
      stopCurrentAudio();
    }
  };

  return {
    playbackState: state,
    toggleReadOutLoud,
    stopCurrentAudio,
  };
}; 