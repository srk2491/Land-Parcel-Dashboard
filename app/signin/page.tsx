import { chatGPTSignInPath } from "../chatgpt-auth";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#f5f8f7] px-6 py-16 text-[#163e38]">
      <section className="mx-auto max-w-lg rounded-2xl border border-[#dce7e3] bg-white p-8 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.12em] text-[#64817a]">Land Bank · Media editor</p>
        <h1 className="mt-3 text-2xl font-semibold">Sign in to manage parcel media</h1>
        <p className="mt-3 text-sm leading-6 text-[#5e716c]">Only the dashboard owner can add, replace, or remove photographs and videos. Published media is visible to people who can open this public dashboard.</p>
        <a className="mt-6 inline-flex rounded-lg bg-[#17675b] px-5 py-3 text-sm font-semibold text-white hover:bg-[#12574d]" href={chatGPTSignInPath("/index.html")} target="_top">Continue with ChatGPT</a>
        <a className="ml-4 text-sm font-medium text-[#17675b] underline" href="/index.html">Return to dashboard</a>
      </section>
    </main>
  );
}
