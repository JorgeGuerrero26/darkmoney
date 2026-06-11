import { useEffect } from "react";

type PageMetaOptions = {
  title: string;
  description?: string;
};

const BRAND_NAME = "DarkMoney";

export function usePageMeta({ title, description }: PageMetaOptions) {
  useEffect(() => {
    const previousTitle = document.title;
    document.title = title.includes(BRAND_NAME) ? title : `${title} · ${BRAND_NAME}`;

    let metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    const previousDescription = metaDescription?.content ?? null;

    if (description) {
      if (!metaDescription) {
        metaDescription = document.createElement("meta");
        metaDescription.name = "description";
        document.head.appendChild(metaDescription);
      }

      metaDescription.content = description;
    }

    return () => {
      document.title = previousTitle;

      if (description && metaDescription && previousDescription !== null) {
        metaDescription.content = previousDescription;
      }
    };
  }, [title, description]);
}
