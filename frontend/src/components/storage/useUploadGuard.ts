import { useStorageStore } from '@/stores/storageStore';

export function useUploadGuard() {
  const getSummary = useStorageStore((s) => s.getSummary);
  const addBook = useStorageStore((s) => s.addBook);

  function guardAndAdd(bookName: string, fileSizeBytes: number): boolean {
    const summary = getSummary();

    // 书架容量检查
    if (summary.shelfUsed >= summary.shelfCapacity) {
      useStorageStore.getState().upgradeShelfCapacity();
      return false;
    }

    return true;
  }

  function checkBeforeUpload(bookName: string, fileSizeBytes: number): { ok: boolean; reason?: string } {
    const summary = getSummary();

    if (summary.shelfUsed >= summary.shelfCapacity) {
      return { ok: false, reason: `书架已满（${summary.shelfUsed}/${summary.shelfCapacity}），请扩容或删除书籍` };
    }

    return { ok: true };
  }

  return { guardAndAdd, checkBeforeUpload, addBook };
}