import { PRESET_BOOKS } from "@/constants/books";

export const buildLibraryLink = (bookTitle: string) => {
  const preset = PRESET_BOOKS.find((book) => book.title === bookTitle);

  if (preset) {
    return preset.link;
  }

  const search = encodeURIComponent(bookTitle);
  return `https://ss.zhizhen.com/s?sw=${search}`;
};
