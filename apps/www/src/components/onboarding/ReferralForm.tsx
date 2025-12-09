import clsx from "clsx";
import { object, string } from "yup";
import { useCookies } from "react-cookie";
import { TabPanel } from "@headlessui/react";
import { Formik, Form, Field } from "formik";
import { useMutation } from "@tanstack/react-query";

import { useTRPCClient } from "@/trpc.client";

type ReferralFormProps = {
  onNext?: () => void;
};
type Extra = { verified?: string };
export default function ReferralForm({ onNext }: ReferralFormProps) {
  const trpcClient = useTRPCClient();

  const [, setCookies] = useCookies<keyof Extra, Partial<Extra>>(["verified"]);
  const { mutateAsync } = useMutation({
    async mutationFn(values: { code: string }) {
      const response = await trpcClient.refer.verify.query(values);
      if (response.referer)
        await trpcClient.refer.create.mutate({ referer: response.referer.id });
      return response;
    },
    onSuccess(values) {
      if (values.exists) {
        setCookies("verified", values.exists);
        return onNext?.();
      }
    },
  });

  return (
    <Formik
      validateOnMount
      validationSchema={object({
        code: string().label("code").trim().required(),
      })}
      initialValues={{
        code: "",
      }}
      onSubmit={async (values, { setFieldError }) => {
        const response = await mutateAsync(values);
        if (response.exists) return;

        setFieldError("code", "This code is invalid.");
      }}
    >
      {({ errors, isSubmitting, isValid }) => (
        <Form className="flex-1 flex flex-col lt-sm:justify-end sm:justify-center">
          <TabPanel className="flex flex-col space-y-4">
            <div className="flex flex-col space-y-2">
              <div className="flex flex-col">
                <Field
                  name="code"
                  placeholder="Enter Code"
                  className="border border-white/20 p-2 rounded focus:border-primary"
                />
                <span className="first-letter:uppercase text-red-500">
                  {errors.code}
                </span>
              </div>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  className="ml-auto text-primary"
                >
                  Get Code
                </button>
              </div>
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
              <span>Next</span>
            </button>
          </TabPanel>
        </Form>
      )}
    </Formik>
  );
}
