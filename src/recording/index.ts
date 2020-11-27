import {DOMRecFrame} from './DOMRecFrame'
import {DOMRecorder} from './DOMRecorder'

export {DOMRecorder, DOMRecFrame}

if (typeof window !== 'undefined') {
  (window as any).DOMRecorder = DOMRecorder;
  (window as any).DOMRecFrame = DOMRecFrame;
}