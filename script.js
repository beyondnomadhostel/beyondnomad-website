emailjs.init({
    publicKey: "dRIDOs3HTPHmvgQXl",
});

document.getElementById("bookingForm").addEventListener("submit", function (e) {

    e.preventDefault();

    const name = document.getElementById("name").value;
const email = document.getElementById("email").value;
const phone = document.getElementById("phone").value;
const room = document.getElementById("room").value;
const checkin = document.getElementById("checkin").value;
const checkout = document.getElementById("checkout").value;
const request = document.getElementById("requests").value;
    // Send Email
    

console.log(emailjs);
console.log("Public Key:", "dRIDOs3HTPHmvgQXI");
console.log("Service:", "service_z630sj9");
console.log("Template:", "template_15rimyu");
emailjs.send(
        "service_z630sj9",
        "template_15rimyu",
        {
            name: name,
            email: email,
            phone: phone,
            checkin: checkin,
            checkout: checkout,
            room: room,
            message: request
        }
    ).then(function () {
        console.log("Email sent successfully!");
    }).catch(function (error) {
        console.error("EmailJS Error:", error);
    });

    // WhatsApp Message
    const whatsappMessage = `🏕️ BEYOND NOMAD LUXURY HOSTEL

📌 NEW DIRECT BOOKING REQUEST

👤 Name: ${name}

📧 Email: ${email}

📱 WhatsApp: ${phone}

📅 Check In: ${checkin}

📅 Check Out: ${checkout}

🛏️ Room Type: ${room}

📝 Special Requests:
${request}

Thank you for booking with Beyond Nomad!`;

    window.open(
        "https://wa.me/94773425595?text=" + encodeURIComponent(whatsappMessage),
        "_blank"
    );

    alert("Thank you! Your booking request has been sent.");

    document.getElementById("bookingForm").reset();

});
// ===== Lightbox =====

const galleryImages = document.querySelectorAll(".gallery-grid img");
const lightbox = document.getElementById("lightbox");
const lightboxImg = document.getElementById("lightbox-img");
const closeBtn = document.querySelector(".close");
let currentIndex = 0;
const prevBtn = document.querySelector(".prev");
const nextBtn = document.querySelector(".next");

galleryImages.forEach((img, index) => {
    img.addEventListener("click", () => {
        currentIndex = index;
        lightbox.style.display = "flex";
        lightboxImg.src = img.src;
    });
});

closeBtn.addEventListener("click", () => {
    lightbox.style.display = "none";
});

lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
        lightbox.style.display = "none";
    }
});
function showImage(index) {
    if (index < 0) {
        index = galleryImages.length - 1;
    }

    if (index >= galleryImages.length) {
        index = 0;
    }

    currentIndex = index;
    lightboxImg.src = galleryImages[currentIndex].src;
}

prevBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showImage(currentIndex - 1);
});

nextBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    showImage(currentIndex + 1);
});

// ===== Scroll Animations =====

const reveals = document.querySelectorAll(".reveal");

function revealOnScroll() {
    reveals.forEach((element) => {
        const windowHeight = window.innerHeight;
        const revealTop = element.getBoundingClientRect().top;
        const revealPoint = 120;

        if (revealTop < windowHeight - revealPoint) {
            element.classList.add("active");
        }
    });
}

window.addEventListener("scroll", revealOnScroll);
revealOnScroll();

// Scroll Animation



// FAQ

const faqs = document.querySelectorAll(".faq-item");

faqs.forEach(item => {
    item.querySelector(".faq-question").addEventListener("click", () => {
        item.classList.toggle("active");
    });
});