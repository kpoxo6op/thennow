import * as React from "react";
import { cn } from "@/lib/utils";

interface DropdownProps extends React.HTMLAttributes<HTMLDivElement> {
  show: boolean;
}

// Using React.forwardRef to allow forwarding refs just like in BurgerMenu
const Dropdown = React.forwardRef<HTMLDivElement, DropdownProps>(
  ({ show, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "fixed left-0 top-16 h-full w-full bg-background",
          className,
          { hidden: !show }
        )}
        {...props}
      >
        <div className="flex flex-col">
          {["About", "Contact", "FAQ", "Links"].map((item, index) => (
            <div key={index}>
              <div className="flex h-16 items-center justify-start">
                <div className="px-2 py-10 text-lg">{item}</div>
              </div>
              <hr className="mx-2 border-secondary-foreground" />
            </div>
          ))}
        </div>
      </div>
    );
  }
);

Dropdown.displayName = "Dropdown";
export { Dropdown };
