import clsx from "clsx";
import { object, string } from "yup";
import { TabPanel } from "@headlessui/react";
import { Formik, Form, Field } from "formik";

import { useTRPCClient } from "@/trpc.client";

type ReferralFormProps = {
  onNext?: () => void;
};

export default function ReferralForm({ onNext }: ReferralFormProps) {
  const trpc = useTRPCClient();

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
        const response = await trpc.refer.verify.query(values);
        if (response.exists) {
          if (response.referer)
            await trpc.refer.create.mutate({ referer: response.referer.id });
          return onNext?.();
        }

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
