import { Extension } from "@tiptap/core";

/**
 * Tab di dalam editor: menjorok butir daftar, atau menyisipkan tab di paragraf dan blok kode.
 * Di dalam tabel Tab dibiarkan pindah sel. Karena Tab menjadi tombol penulisan, pengguna keyboard
 * keluar dengan menekan Esc lebih dulu: Tab berikutnya berpindah fokus seperti biasa.
 */
export const TabIndent = Extension.create({
  name: "tabIndent",

  addStorage() {
    return { released: false };
  },

  addKeyboardShortcuts() {
    return {
      Escape: () => {
        this.storage.released = true;
        return false;
      },
      Tab: () => {
        if (this.storage.released) {
          this.storage.released = false;
          return false;
        }
        const { editor } = this;
        if (editor.isActive("table")) return false;
        if (editor.isActive("listItem")) {
          editor.commands.sinkListItem("listItem");
          return true;
        }
        return editor.commands.insertContent("\t");
      },
      "Shift-Tab": () => {
        const { editor } = this;
        if (editor.isActive("table")) return false;
        if (editor.isActive("listItem")) {
          editor.commands.liftListItem("listItem");
          return true;
        }
        return false;
      },
    };
  },
});
