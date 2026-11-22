import {
  deleteS3ObjectByUrl,
  extractS3KeyFromUrl,
  isS3Configured,
} from "@/lib/s3/storage";

/**
 * `user.image` is user-controlled, so it must never decide on its own which
 * object gets deleted: only this user's own avatar key qualifies.
 */
export async function deleteStoredProfileImage(
  url: string,
  userId: string,
): Promise<void> {
  if (!url || !isS3Configured()) return;

  const key = extractS3KeyFromUrl(url);
  const ownPrefix = `profiles/${userId}/avatar.`;
  if (!key?.startsWith(ownPrefix)) return;
  if (!/^[a-z0-9]+$/i.test(key.slice(ownPrefix.length))) return;

  try {
    await deleteS3ObjectByUrl(url);
  } catch (error) {
    console.error("Error deleting S3 profile image:", error);
  }
}
