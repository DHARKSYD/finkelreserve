import { useMutation } from "@tanstack/react-query";
import { sendContactMessage, subscribeNewsletter } from "@/lib/actions/contact";

export const useSendContactMessage = () =>
  useMutation({
    mutationFn: async (input: { name: string; email: string; topic?: string; message: string }) => {
      const result = await sendContactMessage({ data: input });
      if (!result.ok) throw new Error(result.error);
    },
  });

export const useSubscribeNewsletter = () =>
  useMutation({
    mutationFn: async (email: string) => {
      const result = await subscribeNewsletter({ data: { email } });
      if (!result.ok) throw new Error(result.error);
    },
  });
