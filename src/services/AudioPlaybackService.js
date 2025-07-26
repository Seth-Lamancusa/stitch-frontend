import { reactive } from 'vue';
import MessageService from './MessageService';

const state = reactive({
  currentlyPlaying: null,
  isLoading: false,
});

let audio = null;

const stopCurrentAudio = () => {
  console.log('[AudioPlayback] stopCurrentAudio called');
  if (audio) {
    // Remove event listeners before cleanup to prevent spurious error events
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.pause();
    audio.src = '';
    audio = null;
  }
  state.currentlyPlaying = null;
  state.isLoading = false;
  console.log('[AudioPlayback] State after stop:', { currentlyPlaying: state.currentlyPlaying, isLoading: state.isLoading });
};

const playAudio = (messageId, url) => {
  console.log('[AudioPlayback] playAudio called for message:', messageId);
  // Clean up previous audio if it exists
  if (audio) {
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.pause();
    audio.src = '';
    audio = null;
  }
  
  audio = new Audio(url);
  state.currentlyPlaying = messageId;
  console.log('[AudioPlayback] Audio object created, state:', { currentlyPlaying: state.currentlyPlaying, isLoading: state.isLoading });

  // Wait for the 'playing' event which fires when audio actually starts playing
  audio.onplaying = () => {
    console.log('[AudioPlayback] Audio playing event fired');
    state.isLoading = false;
    console.log('[AudioPlayback] Loading set to false, state:', { currentlyPlaying: state.currentlyPlaying, isLoading: state.isLoading });
  };

  audio.play().catch(error => {
    console.error('Error playing audio:', error);
    stopCurrentAudio();
  });

  audio.onended = () => {
    console.log('[AudioPlayback] Audio ended');
    URL.revokeObjectURL(url);
    stopCurrentAudio();
  };

  audio.onerror = () => {
    console.error('Audio loading/playback error');
    stopCurrentAudio();
  };
};

export const useAudioPlayback = () => {
  const toggleReadOutLoud = async (messageId) => {
    console.log('[AudioPlayback] toggleReadOutLoud called for message:', messageId);
    console.log('[AudioPlayback] Current state before toggle:', { currentlyPlaying: state.currentlyPlaying, isLoading: state.isLoading });
    
    if (state.currentlyPlaying === messageId) {
      console.log('[AudioPlayback] Stopping current audio (same message)');
      stopCurrentAudio();
      return;
    }

    stopCurrentAudio();
    state.isLoading = true;
    state.currentlyPlaying = messageId;
    console.log('[AudioPlayback] Set loading=true, currentlyPlaying=', messageId, 'state:', { currentlyPlaying: state.currentlyPlaying, isLoading: state.isLoading });

    try {
      console.log('[AudioPlayback] Fetching audio data...');
      const response = await MessageService.getReadOutLoudAudio(messageId);
      console.log('[AudioPlayback] Audio data received, creating blob and URL...');
      const blob = new Blob([response.data], { type: 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      console.log('[AudioPlayback] Calling playAudio...');
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