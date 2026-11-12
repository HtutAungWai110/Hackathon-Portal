import { useMutation } from '@tanstack/react-query';
import { uploadEventImages } from './events-api';

/**
 * Uploading is its own mutation, not part of creating the event: the files are
 * written as soon as they are picked, and the create call only carries the
 * returned URLs. Nothing is cached yet, so there is no query to invalidate.
 */
export function useUploadEventImages() {
  return useMutation({
    mutationFn: (files: readonly File[]) => uploadEventImages(files),
  });
}
