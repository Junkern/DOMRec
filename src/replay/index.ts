import { DOMReplayManager } from './DOMReplayManager'

if (typeof window !== 'undefined') {
  (window as any).DOMReplayManager = DOMReplayManager;
}
