document.getElementById("downloadBtn").addEventListener("click", function() {
    const fileUrl = "https://github.com/nipscernlab/sapho/raw/main/Sapho_atual/Setup/inno/SAPHO.exe";
    const a = document.createElement("a");
    a.href = fileUrl;
    a.download = "SAPHO.exe";  // Name of the file after download
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
});
