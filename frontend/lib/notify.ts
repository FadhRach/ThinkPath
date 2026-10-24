import { toast } from "sonner";

/**
 * Pemberitahuan singkat yang hilang sendiri (toast). Satu tempat untuk durasi
 * dan gaya supaya pesan sukses/galat seragam di seluruh aplikasi.
 * Untuk pesan yang harus tetap terlihat di halaman, pakai komponen `Alert`.
 */
export const notify = {
  success: (message: string, description?: string) => toast.success(message, { description }),
  error: (message: string, description?: string) =>
    toast.error(message, { description, duration: 8000 }),
  info: (message: string, description?: string) => toast.info(message, { description }),
};
