export default function Footer() {
  return (
    <footer className="app-footer">
      © {new Date().getFullYear()} NAVBODH PRAKASHAN. All rights reserved.
      <span className="footer-sep">|</span>
      Developed by{' '}
      <a href="https://namanjain-rho.vercel.app/" target="_blank" rel="noopener noreferrer">Naman Jain</a>
    </footer>
  );
}