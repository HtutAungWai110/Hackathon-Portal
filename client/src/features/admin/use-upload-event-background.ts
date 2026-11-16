import { useMutation } from '@tanstack/react-query';
import { uploadEventBackground } from './events-api';

/**
 * One file, uploaded the moment it is picked, like the gallery. The event body
 * then carries the returned URL, so saving never waits on a multipart request.
 */
export function useUploadEventBackground() {
  return useMutation({
    mutationFn: (file: File) => uploadEventBackground(file),
  });
}
