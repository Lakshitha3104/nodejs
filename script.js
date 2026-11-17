
let selected = document.getElementById("selectedLanguages");
let options = document.getElementById("options");
let boxes = document.querySelectorAll("#options input");

// Open language dropdown
selected.onclick = function () {
    options.classList.toggle("show");
};

// Select languages
boxes.forEach(function (box) {
    box.onchange = function () {
        let languages = [];

        boxes.forEach(function (item) {
            if (item.checked) {
                languages.push(item.value);
            }
        });

        selected.innerHTML = languages.join(", ") || "Select Languages";
    };
});

// Convert PDF into Base64
function convertPDFToBase64(file) {
    return new Promise(function (resolve, reject) {
        const reader = new FileReader();

        reader.onload = function () { 
            resolve(reader.result);
        };

        reader.onerror = function () {
            reject(new Error("Unable to read PDF file."));
        };

        reader.readAsDataURL(file);
    });
}

// Submit form
document.getElementById("employeeForm").onsubmit = async function (event) {
    event.preventDefault();

    const resume = document.getElementById("resume").files[0];

    // Validate PDF
    if (
        !resume ||
        resume.type !== "application/pdf" ||
        resume.size > 5 * 1024 * 1024
    ) {
        alert("Please upload a PDF file under 5MB.");
        return;
    }

    // Get selected languages
    let languages = [];

    boxes.forEach(function (box) {
        if (box.checked) {
            languages.push(box.value);
        }
    });

    if (languages.length === 0) {
        alert("Please select a language.");
        return;
    }

    // Get gender
    const genderInput = document.querySelector(
        'input[name="gender"]:checked'
    );

    if (!genderInput) {
        alert("Please select your gender.");
        return;
    }

    try {
        // Convert PDF to Base64
        const resumeBase64 = await convertPDFToBase64(resume);

        // Prepare employee data
        const employeeData = {
            name: document.getElementById("name").value,
            dob: document.getElementById("dob").value,
            email: document.getElementById("email").value,
            address: document.getElementById("address").value,
            gender: genderInput.value,
            qualification: document.getElementById("qualification").value,
            languages: languages,
            phone: document.getElementById("phone").value,
            resume: resumeBase64
        };

        // Send data to Node.js server
        const response = await fetch("/submit", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(employeeData)
        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.message || "Form submission failed.");
        }

        alert(result.message);

        // Reset form after successful submission
        this.reset();

        selected.innerHTML = "Select Languages";
        options.classList.remove("show");

    } catch (error) {
        console.error("Submission error:", error);
        alert(error.message || "Something went wrong. Please try again.");
    }
};
