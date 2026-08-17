import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../components/Button";
import "./Landing.css";

const VIDEOS = [
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081127_0992a171-d3c6-4978-8213-0ec5df8b6d63.mp4",
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_092026_dd05b805-ea0f-40b2-8c52-332b88502592.mp4",
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_081042_df7202bf-bd80-4b2b-bbc6-1f09ba2870e9.mp4",
  "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260702_080959_4cac5234-3573-464e-a5b7-76b94b8a7d61.mp4",
];

const DARK_INDEX = 2; // the lighter/snowy clip — swap all text to black while it's up
const HOLD_MS = 6000;
const FADE_MS = 2200;

const NAV_ITEMS = [
  { label: "Explore", path: "/explore" },
  { label: "Plan", path: "/" },
  { label: "My Trips", path: "/my-trips" },
  { label: "Settings", path: "/settings" },
];

function BrandMark({ color, size = 28 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className="shrink-0" style={{ fill: color, transition: "fill 700ms ease" }}>
      <path d="M357.447 713.497C342.667 692.555 333.214 669.688 330.008 644.709C324.035 598.178 336.277 556.555 366.488 520.612C395.357 486.266 432.676 466.027 476.243 456.796C487.565 454.398 487.601 454.568 487.972 442.94C488.27 433.608 488.233 433.813 479.141 432.179C433.876 424.042 400.826 399.539 380.632 358.082C379.181 355.104 377.444 353.507 374.208 352.677C363.404 349.906 352.623 346.937 342.701 341.656C334.902 337.504 328.424 332.302 328.658 322.225C328.743 318.554 329.999 315.354 332.111 312.513C333.757 310.298 333.817 308.734 331.912 306.441C326.273 299.654 327.787 291.195 335.578 286.46C344.938 280.771 355.556 278.229 366.014 275.53C370.119 274.47 371.85 272.548 373.087 268.52C389.331 215.626 424.778 182.974 479.214 174.19C551.513 162.523 615.435 211.746 627.429 279.818C638.521 342.763 604.037 400.915 548.923 423.735C538.419 428.084 527.538 431.057 516.219 432.358C509.646 433.113 509.356 433.466 509.337 440.057C509.301 452.68 509.307 452.442 522.051 452.732C584.228 454.146 636.305 477.064 675.848 525.927C690.414 543.926 700.034 564.554 705.305 587.097C706.352 591.577 708.35 592.853 712.789 592.777C727.949 592.519 743.116 592.657 758.281 592.692C765.587 592.709 769.295 596.402 769.324 603.774C769.381 618.272 769.46 632.772 769.276 647.268C769.224 651.386 770.572 652.863 774.732 652.74C783.057 652.495 791.394 652.675 799.726 652.675C816.159 652.674 829.293 665.639 829.317 682.125C829.376 722.786 829.375 763.448 829.321 804.109C829.299 820.134 816.014 833.31 799.983 833.317C752.655 833.339 705.328 833.339 658.001 833.307C641.854 833.295 628.776 820.239 628.691 804.097C628.631 792.599 628.696 781.1 628.644 769.602C628.636 767.821 629.092 765.946 627.766 763.753C622.684 766.398 617.625 769.095 612.51 771.683C594.563 780.766 575.671 787.047 555.822 790.274C551.086 791.044 548.969 792.709 549.214 797.948C549.665 807.593 549.521 817.277 549.269 826.936C549.158 831.205 550.372 832.927 554.885 832.757C562.872 832.456 570.88 832.631 578.879 832.704C585.234 832.761 589.264 836.753 589.328 842.869C589.393 848.966 585.339 853.289 579.08 853.296C525.753 853.348 472.426 853.346 419.1 853.305C412.793 853.3 408.728 849.124 408.694 843.03C408.66 836.884 412.628 832.804 419.022 832.716C427.353 832.602 435.688 832.581 444.018 832.717C447.473 832.773 448.728 831.432 448.702 828C448.595 814.002 448.543 800.002 448.756 786.007C448.812 782.321 446.82 781.125 444.021 780.023C427.042 773.34 411.07 764.827 396.499 753.77C381.525 742.407 368.44 729.22 357.447 713.497ZM369.505 552.963C346.353 592.7 342.516 634.022 360.998 676.372C377.648 714.524 406.751 740.407 444.555 757.001C447.349 758.227 449.169 758.502 451.374 755.871C454.359 752.308 458.64 751.794 462.827 753.269C466.928 754.714 469.328 757.879 469.317 762.405C469.311 765.055 470.528 766.107 473.039 766.774C488.251 770.813 503.795 772.282 519.436 772.547C528.433 772.699 528.441 772.265 528.679 763.276C528.852 756.746 532.541 752.872 538.756 752.697C545.606 752.503 549.196 756.355 549.331 764.175C549.386 767.372 549.125 770.274 554.081 769.298C579.934 764.209 603.739 754.4 625.336 739.23C628.038 737.332 628.732 735.116 628.715 732.055C628.623 715.558 628.648 699.06 628.681 682.562C628.715 665.69 641.568 652.767 658.349 652.69C665.848 652.655 673.347 652.673 680.845 652.632C682.649 652.622 684.89 652.924 685.361 650.55C685.945 647.598 687.575 644.648 686.079 641.243C685.025 641.744 684.171 642.243 683.255 642.568C679.004 644.076 674.962 643.743 671.673 640.468C668.238 637.047 667.842 632.854 669.561 628.456C670.164 626.916 671.066 625.49 671.858 624.026C676.751 614.99 675.694 608.616 668.121 601.755C664.265 598.26 659.805 595.668 655.286 593.141C648.942 589.595 646.83 583.721 649.711 578.075C652.508 572.595 658.57 571.212 665.289 574.297C671.295 577.055 676.449 581.182 682.74 585.288C681.832 582.321 681.303 580.26 680.575 578.271C677.189 569.016 673.135 560.026 667.708 551.815C631.558 497.122 578.917 474.333 515.118 473.464C509.133 473.382 507.695 474.951 507.434 480.854C506.895 492.998 505.291 505.009 503.32 516.976C500.558 533.75 496.914 550.299 489.43 565.727C486.018 572.762 480.31 575.256 474.505 572.477C468.792 569.743 467.045 563.636 470.238 556.592C472.789 550.963 474.863 545.181 476.611 539.271C482.25 520.211 484.433 500.573 486.411 480.895C486.772 477.304 484.682 476.834 482.106 477.379C476.416 478.584 470.69 479.749 465.139 481.454C425.005 493.783 392.499 516.427 369.505 552.963ZM440.318 210.855C402.705 234.3 379.701 283.505 393.804 332.581C409.735 388.02 465.327 421.735 520.88 410.274C579.083 398.266 616.405 341.941 606.95 285.115C599.006 237.364 557.766 194.365 499.57 193.504C478.546 193.192 458.767 198.909 440.318 210.855ZM649.347 795.405C649.35 797.237 649.305 799.071 649.365 800.901C649.612 808.424 653.768 812.647 661.301 812.654C706.275 812.698 751.25 812.702 796.224 812.647C804.493 812.637 808.632 808.546 808.644 800.383C808.702 762.072 808.705 723.761 808.643 685.45C808.63 677.58 804.354 673.38 796.575 673.368C766.593 673.322 736.61 673.415 706.628 673.239C702.596 673.216 700.712 674.634 699.336 678.288C689.505 704.396 673.392 726.176 652.764 744.713C650.272 746.951 649.269 749.196 649.298 752.454C649.419 766.445 649.348 780.438 649.347 795.405ZM519.392 793.317C504.332 793.836 489.488 792.05 474.812 788.865C470.755 787.985 469.278 789.141 469.316 793.222C469.422 804.887 469.419 816.553 469.308 828.218C469.278 831.343 470.216 832.739 473.571 832.716C490.402 832.603 507.234 832.621 524.065 832.682C527.133 832.693 528.697 831.719 528.668 828.387C528.579 818.056 528.62 807.723 528.68 797.392C528.696 794.703 527.595 793.329 524.849 793.366C523.349 793.386 521.849 793.339 519.392 793.317ZM714.836 613.342C710.824 612.87 709.168 614.442 709.272 618.673C709.507 628.305 709.493 637.95 709.282 647.583C709.195 651.537 710.634 652.815 714.502 652.737C724.301 652.539 734.11 652.554 743.911 652.72C747.75 652.784 748.744 651.053 748.701 647.58C748.577 637.778 748.545 627.971 748.726 618.17C748.796 614.387 747.23 613.256 743.682 613.308C734.379 613.443 725.072 613.344 714.836 613.342ZM649.342 693.533C649.342 701.026 649.342 708.519 649.342 716.012C649.915 716.129 650.489 716.247 651.062 716.364C662.272 703.956 671.43 690.241 677.68 674.277C674.395 672.795 671.543 673.392 668.802 673.382C651.009 673.32 649.342 674.995 649.342 693.533ZM370.238 327.798C370.008 325.03 369.847 322.253 369.52 319.497C369.33 317.885 368.142 317.13 366.657 317.619C362.652 318.937 358.431 319.834 354.379 323.16C359.508 326.067 364.102 328.602 370.238 327.798Z"/>
      <path d="M594.335 658.43C576.99 667.97 559.244 674.563 539.345 673.33C520.046 672.134 504.272 663.691 491.146 649.937C487.53 646.148 487.757 639.925 490.985 636.156C494.115 632.5 499.769 631.421 504.216 633.865C505.938 634.812 507.474 636.17 508.928 637.52C523.815 651.346 540.879 655.792 560.545 649.932C568.265 647.631 575.539 644.44 582.509 640.471C584.344 639.426 585.931 638.403 584.63 635.811C579.28 625.156 572.624 615.777 560.965 611.231C549.124 606.614 537.422 608.853 525.765 612.099C523.519 612.724 521.325 613.413 518.929 613.349C514.003 613.219 510.031 610.364 508.892 605.939C507.553 600.738 509.374 595.543 514.198 593.741C544.947 582.252 580.733 584.198 600.452 619.787C603.609 625.486 606.237 631.405 608.358 637.566C610.681 644.31 609.401 648.774 603.594 652.754C600.713 654.728 597.64 656.424 594.335 658.43Z"/>
      <path d="M530.657 282.765C535.943 284.037 538.894 286.983 539.298 292.133C539.661 296.759 537.81 300.291 533.64 302.308C529.742 304.193 525.856 303.848 522.426 301.088C518.589 298 517.728 293.786 519.245 289.398C520.978 284.383 524.986 282.338 530.657 282.765Z"/>
      <path d="M709.641 718.226C712.104 714.033 715.52 712.564 719.898 712.653C726.228 712.781 732.563 712.614 738.894 712.705C745.324 712.798 749.178 716.55 749.299 722.939C749.428 729.768 749.444 736.605 749.289 743.433C749.158 749.214 745.249 753.143 739.501 753.266C732.339 753.419 725.169 753.424 718.007 753.268C713.436 753.169 709.131 749.84 708.963 745.465C708.62 736.524 707.827 727.528 709.641 718.226Z"/>
    </svg>
  );
}

export default function Landing() {
  const navigate = useNavigate();
  const [active, setActive] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const transitioning = useRef(false);

  const isDark = active === DARK_INDEX;
  const fg = isDark ? "#000000" : "#ffffff";

  useEffect(() => {
    const id = setInterval(() => {
      if (transitioning.current) return;
      transitioning.current = true;
      setActive((prev) => (prev + 1) % VIDEOS.length);
      setTimeout(() => {
        transitioning.current = false;
      }, FADE_MS);
    }, HOLD_MS + FADE_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative w-full h-screen overflow-hidden bg-black">
      {VIDEOS.map((src, idx) => (
        <video
          key={src}
          className="landing-bg-video absolute inset-0 w-full h-full object-cover"
          style={{ opacity: idx === active ? 1 : 0 }}
          autoPlay
          muted
          loop
          playsInline
          src={src}
        />
      ))}

      <div className="absolute inset-0 bg-black/25 pointer-events-none" />

      <div className="relative z-10 flex flex-col h-full" style={{ color: fg, transition: "color 700ms ease" }}>
        <nav className="flex items-center justify-between px-6 py-5 sm:px-10 sm:py-6">
          <div className="flex items-center gap-2">
            <BrandMark color={fg} size={42} />
            <span className="font-heading font-semibold text-xl sm:text-2xl">Battuta</span>
          </div>

          <div className="hidden md:flex liquid-glass rounded-full items-center gap-6 pl-6 pr-2 py-2">
            {NAV_ITEMS.map((item) => (
              <Link key={item.path} to={item.path} className="text-sm opacity-80 hover:opacity-100 transition-opacity">
                {item.label}
              </Link>
            ))}
            <button
              className="bg-primary-orange text-white text-sm font-medium rounded-full px-4 py-2 transition-opacity hover:opacity-90"
              onClick={() => navigate("/")}
            >
              Get Started
            </button>
          </div>

          <button
            className={`md:hidden liquid-glass rounded-full w-11 h-11 flex items-center justify-center ${menuOpen ? "landing-menu-open" : ""}`}
            style={{ color: fg }}
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            <span className="landing-icon-wrap">
              <svg className="landing-icon-menu" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              <svg className="landing-icon-close" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </span>
          </button>
        </nav>

        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <div className="liquid-glass rounded-full px-4 py-1.5 mb-6 text-xs sm:text-sm opacity-90">
            Over 10,000 explorers already chasing forgotten stories
          </div>

          <h1 className="font-heading font-semibold text-4xl sm:text-5xl md:text-7xl lg:text-[5.5rem] leading-[1.1] max-w-4xl">
            Fully Experience<br />Every Trip
          </h1>

          <p className="mt-6 max-w-xl leading-relaxed opacity-80 text-sm sm:text-base">
            Plan what's worth seeing. Discover more along the way.
            Never miss a place that matters.
          </p>

          <Button variant="orange" className="mt-8" onClick={() => navigate("/")}>
            Start Planning your Trip
          </Button>
        </div>

        <div className="px-6 pb-6 sm:pb-8 flex items-center justify-center gap-2 sm:gap-3 flex-wrap opacity-70 text-xs sm:text-sm">
          <span>Thousands of Cultural Sites</span>
          <span className="hidden sm:inline">|</span>
          <span>12,000+ Explorers</span>
          <span className="hidden sm:inline">|</span>
          <span>4.8 User Rating</span>
        </div>
      </div>

      <div className={`landing-mobile-menu fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center gap-8 ${menuOpen ? "open" : ""}`}>
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="landing-menu-link text-white text-3xl font-heading font-semibold"
            onClick={() => setMenuOpen(false)}
          >
            {item.label}
          </Link>
        ))}
        <Button variant="orange" className="landing-menu-link landing-menu-cta mt-4" onClick={() => navigate("/")}>
          Get Started
        </Button>
      </div>
    </section>
  );
}
