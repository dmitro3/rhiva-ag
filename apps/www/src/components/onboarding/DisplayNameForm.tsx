import clsx from "clsx";
import type z from "zod";
import { object, string } from "yup";
import { useCookies } from "react-cookie";
import { TabPanel } from "@headlessui/react";
import { Formik, Form, Field } from "formik";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useMutation } from "@tanstack/react-query";
import type { extraAuthSchema } from "@rhiva-ag/trpc";

import { useTRPCClient } from "@/trpc.client";

type Extra = z.infer<typeof extraAuthSchema>;

export default function DisplayNameForm() {
  const trpc = useTRPCClient();
  const { user, updateUser } = useAuth();
  const [cookies, setCookies] = useCookies<keyof Extra, Extra>(["displayName"]);
  const { mutateAsync } = useMutation({
    mutationFn: async (values: Extra) => {
      if (user) return trpc.user.update.mutate(values).then(updateUser);
      else return setCookies("displayName", values.displayName);
    },
  });

  return (
    <Formik
      validateOnMount
      validationSchema={object({
        displayName: string().label("Display name").trim().required(),
      })}
      initialValues={{
        displayName: cookies.displayName,
      }}
      onSubmit={(values) => mutateAsync(values)}
    >
      {({ errors, isSubmitting, isValid }) => (
        <Form className="flex-1 flex flex-col lt-sm:justify-end sm:justify-center">
          <TabPanel className="flex flex-col space-y-4">
            <div className="flex flex-col">
              <Field
                name="displayName"
                placeholder="Choose a display name"
                className="border border-white/20 p-2 rounded focus:border-primary"
              />
              <span className="first-letter:uppercase text-red-500">
                {errors.displayName}
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting && !isValid}
              className={clsx(
                "flex items-center justify-center space-x-2 rounded p-2",
                isValid ? "bg-primary text-black" : "bg-gray text-black",
              )}
            >
              {isSubmitting && (
                <div className="size-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
              )}
              <span>Submit</span>
            </button>
          </TabPanel>
        </Form>
      )}
    </Formik>
  );
}
