import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getFindingUser, setFindingUser, type FindingUser } from "@/lib/findings";

/** Simple name + email identity so activity can be attributed. */
export function FindingGate({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FindingUser | null>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");

  useEffect(() => {
    setUser(getFindingUser());
    setReady(true);
  }, []);

  if (!ready) return null;

  if (!user) {
    return (
      <div className="mx-auto max-w-md">
        <div className="surface p-6">
          <p className="text-eyebrow">Finding</p>
          <h1 className="mt-1 text-2xl text-primary">Who are you?</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your name is saved with every change you make in the Finding section.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              const value = { name: name.trim(), email: email.trim() };
              if (!value.name) return;
              setFindingUser(value);
              setUser(value);
            }}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Name"
              maxLength={80}
              className="h-11 rounded-xl"
            />
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email"
              type="email"
              maxLength={160}
              className="h-11 rounded-xl"
            />
            <Button type="submit" className="h-11 w-full rounded-xl">
              Continue
            </Button>
          </form>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
