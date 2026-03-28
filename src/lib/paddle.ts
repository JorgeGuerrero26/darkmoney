const PADDLE_SCRIPT_URL = "https://cdn.paddle.com/paddle/v2/paddle.js";

type PaddleEnvironment = "sandbox" | "production";

type PaddleEventCallback = (event: {
  name?: string;
  data?: Record<string, unknown> | null;
}) => void;

type PaddleRuntime = {
  Environment?: {
    set: (environment: PaddleEnvironment) => void;
  };
  Initialize: (input: {
    token: string;
    eventCallback?: PaddleEventCallback;
  }) => void;
  Checkout: {
    open: (input: {
      settings?: {
        allowLogout?: boolean;
        displayMode?: "overlay" | "inline";
        locale?: string;
        successUrl?: string;
        theme?: "light" | "dark";
        variant?: "multi-page" | "one-page";
      };
      items: Array<{
        priceId: string;
        quantity?: number;
      }>;
      customer?: {
        email?: string;
      };
      customData?: Record<string, string>;
    }) => void;
  };
};

let paddleLoaderPromise: Promise<PaddleRuntime> | null = null;
let initializedToken: string | null = null;
let initializedEnvironment: PaddleEnvironment | null = null;

function getWindowPaddle() {
  return (window as Window & { Paddle?: PaddleRuntime }).Paddle;
}

function getRequiredFrontendEnv(name: string, value?: string) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`Falta configurar ${name} para abrir Paddle.`);
  }

  return normalizedValue;
}

export function getPaddleClientToken() {
  return getRequiredFrontendEnv("VITE_PADDLE_CLIENT_TOKEN", import.meta.env.VITE_PADDLE_CLIENT_TOKEN);
}

export function getPaddleProPriceId() {
  return getRequiredFrontendEnv("VITE_PADDLE_PRO_PRICE_ID", import.meta.env.VITE_PADDLE_PRO_PRICE_ID);
}

export function isPaddleCheckoutConfigured() {
  return Boolean(
    import.meta.env.VITE_PADDLE_CLIENT_TOKEN?.trim() &&
      import.meta.env.VITE_PADDLE_PRO_PRICE_ID?.trim(),
  );
}

function resolvePaddleEnvironment() {
  const configuredEnvironment = import.meta.env.VITE_PADDLE_ENV?.trim().toLowerCase();

  if (configuredEnvironment === "sandbox" || configuredEnvironment === "production") {
    return configuredEnvironment;
  }

  return getPaddleClientToken().startsWith("test_") ? "sandbox" : "production";
}

function buildPaddleSuccessUrl(appUrl: string) {
  const baseUrl = new URL(appUrl.endsWith("/") ? appUrl : `${appUrl}/`);
  return new URL("app/settings?billing=paddle", baseUrl).toString();
}

async function loadPaddleRuntime() {
  if (typeof window === "undefined") {
    throw new Error("Paddle solo se puede abrir desde el navegador.");
  }

  const existingPaddle = getWindowPaddle();

  if (existingPaddle) {
    return existingPaddle;
  }

  if (!paddleLoaderPromise) {
    paddleLoaderPromise = new Promise<PaddleRuntime>((resolve, reject) => {
      const existingScript = document.querySelector<HTMLScriptElement>(
        `script[src="${PADDLE_SCRIPT_URL}"]`,
      );

      function resolvePaddle() {
        const runtime = getWindowPaddle();

        if (!runtime) {
          reject(new Error("Paddle cargo, pero no expuso la libreria en la ventana."));
          return;
        }

        resolve(runtime);
      }

      if (existingScript) {
        existingScript.addEventListener("load", resolvePaddle, { once: true });
        existingScript.addEventListener(
          "error",
          () => reject(new Error("No pudimos cargar Paddle.js.")),
          { once: true },
        );

        if (getWindowPaddle()) {
          resolvePaddle();
        }

        return;
      }

      const script = document.createElement("script");
      script.src = PADDLE_SCRIPT_URL;
      script.async = true;
      script.onload = resolvePaddle;
      script.onerror = () => reject(new Error("No pudimos descargar Paddle.js."));
      document.head.appendChild(script);
    });
  }

  return paddleLoaderPromise;
}

async function initializePaddle() {
  const paddle = await loadPaddleRuntime();
  const token = getPaddleClientToken();
  const environment = resolvePaddleEnvironment();

  if (initializedToken === token && initializedEnvironment === environment) {
    return paddle;
  }

  paddle.Environment?.set(environment);
  paddle.Initialize({
    token,
  });

  initializedToken = token;
  initializedEnvironment = environment;

  return paddle;
}

export async function openPaddleProCheckout(input: {
  appUrl: string;
  payerEmail: string;
  userId: string;
  workspaceId?: number | null;
}) {
  const paddle = await initializePaddle();
  const successUrl = buildPaddleSuccessUrl(input.appUrl);
  const customData: Record<string, string> = {
    source: "darkmoney_pro",
    user_id: input.userId,
  };

  if (typeof input.workspaceId === "number") {
    customData.workspace_id = String(input.workspaceId);
  }

  paddle.Checkout.open({
    settings: {
      allowLogout: false,
      displayMode: "overlay",
      locale: "es",
      successUrl,
      theme: "dark",
      variant: "one-page",
    },
    items: [
      {
        priceId: getPaddleProPriceId(),
        quantity: 1,
      },
    ],
    customer: {
      email: input.payerEmail,
    },
    customData,
  });
}
