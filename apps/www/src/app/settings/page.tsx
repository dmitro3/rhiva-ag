"use client";
import { toast } from "react-toastify";
import { Form, Formik, Field } from "formik";
import { useAuth } from "@rhiva-ag/auth-ui/client";
import { useMutation } from "@tanstack/react-query";

import { useTRPC } from "@/trpc.client";
import Toggle from "@/components/Toggle";

import Header from "@/components/layout/Header";
import RebalanceTime from "@/components/settings/RebalanceTime";
import RebalanceType from "@/components/settings/RebalanceType";

export default function SettingsPage() {
  const trpc = useTRPC();
  const { user, updateUser } = useAuth();

  const { mutateAsync } = useMutation(
    trpc.settings.update.mutationOptions({
      onSuccess(settings) {
        updateUser({ settings });
      },
    }),
  );

  return (
    user && (
      <div className="flex-1 flex flex-col space-y-8 overflow-y-scroll lt-sm:fixed lt-sm:inset-0 lt-md:z-50 lt-sm:bg-dark">
        <Header
          canBack
          title="Settings"
          className="sticky top-0 z-10 md:px-12"
        />
        <div className="flex-1 flex flex-col px-4  overflow-y-scroll md:p-16">
          <Formik
            initialValues={user.settings}
            onSubmit={(values) =>
              mutateAsync(values).then(() =>
                toast.success("Settings updated successfully"),
              )
            }
          >
            {({ values, setFieldValue, isSubmitting }) => (
              <Form className="flex-1 flex flex-col space-y-4 ">
                <div className="flex flex flex-col  space-y-4 bg-white/3 border border-white/10 backdrop-blur-3xl p-4 rounded-md md:flex-1 md:p-16 md:justify-center md:justify-between md:gap-y-8">
                  <div className="flex items-center md:space-x-28">
                    <label
                      htmlFor="slippage"
                      className="lt-sm:flex-1"
                    >
                      Slippage
                    </label>
                    <Field
                      name="slippage"
                      className="p-2 border border-white/10 rounded focus:border-primary lt-sm:flex-1 md:min-w-md"
                    />
                  </div>
                  <div className="flex items-center md:space-x-16">
                    <label
                      htmlFor="gasPriorityFee"
                      className="lt-sm:flex-1"
                    >
                      Gas priority fee
                    </label>
                    <Field
                      name="gasPriorityFee"
                      className="p-2 border border-white/10 rounded focus:border-primary lt-sm:flex-1 md:min-w-md"
                    />
                  </div>
                  <div className="flex items-center md:space-x-16">
                    <label
                      htmlFor="rebalanceTime"
                      className="lt-sm:flex-1"
                    >
                      Rebalance time
                    </label>
                    <RebalanceTime
                      className="lt-sm:flex-1 md:min-w-md"
                      value={values.rebalanceTime}
                      onChange={(value) =>
                        setFieldValue("rebalanceTime", value)
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-8 md:space-x-28">
                    <label
                      htmlFor="slippage"
                      className="lt-sm:flex-1"
                    >
                      Auto claim
                    </label>
                    <div className="lt-sm:flex-1 md:min-w-m">
                      <Toggle
                        value={values.enableAutoClaim}
                        onChange={(value) =>
                          setFieldValue("enableAutoClaim", value)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center space-x-8 md:space-x-18">
                    <label
                      htmlFor="slippage"
                      className="lt-sm:flex-1"
                    >
                      Auto compound
                    </label>
                    <div className="lt-sm:flex-1 md:min-w-m">
                      <Toggle
                        value={values.enableAutoCompound}
                        onChange={(value) =>
                          setFieldValue("enableAutoCompound", value)
                        }
                      />
                    </div>
                  </div>
                  <div className="flex items-center md:space-x-12">
                    <label
                      htmlFor="slippage"
                      className="lt-sm:flex-1 text-nowrap"
                    >
                      Rebalancing type
                    </label>
                    <RebalanceType
                      className="lt-sm:flex-1 md:min-w-m"
                      value={values.rebalanceType}
                      onChange={(value) =>
                        setFieldValue("rebalanceType", value)
                      }
                    />
                  </div>
                  <div className="flex items-center space-x-8 md:space-x-8">
                    <label
                      htmlFor="slippage"
                      className="lt-sm:flex-1"
                    >
                      Message Notifications
                    </label>
                    <div className="lt-sm:flex-1 md:min-w-m">
                      <Toggle
                        value={values.enableNotifications}
                        onChange={(value) =>
                          setFieldValue("enableNotifications", value)
                        }
                      />
                    </div>
                  </div>
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="flex items-center justify-center min-w-36 bg-primary text-black px-3 rounded"
                  >
                    {isSubmitting ? (
                      <div className="my-1.5 size-6 border-3 border-t-transparent border-black rounded-full animate-spin" />
                    ) : (
                      <span className="py-2">Save</span>
                    )}
                  </button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    )
  );
}
