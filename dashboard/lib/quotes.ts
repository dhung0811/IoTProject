const quotes = [
  { text: "Take care of your body. It's the only place you have to live.", author: "Jim Rohn" },
  { text: "Health is not valued till sickness comes.", author: "Thomas Fuller" },
  { text: "The greatest wealth is health.", author: "Virgil" },
  { text: "Your body hears everything your mind says.", author: "Naomi Judd" },
  { text: "A healthy outside starts from the inside.", author: "Robert Urich" },
  { text: "To keep the body in good health is a duty.", author: "Buddha" },
  { text: "Health is the crown on the well person's head.", author: "Robin Sharma" },
  { text: "An ounce of prevention is worth a pound of cure.", author: "Benjamin Franklin" },
  { text: "The first wealth is health.", author: "Ralph Waldo Emerson" },
  { text: "Physical fitness is the first requisite of happiness.", author: "Joseph Pilates" },
  { text: "Keeping your body healthy is an expression of gratitude.", author: "Thich Nhat Hanh" },
  { text: "A good laugh and a long sleep are the best cures.", author: "Irish Proverb" },
  { text: "It is health that is real wealth, not pieces of gold.", author: "Mahatma Gandhi" },
  { text: "Movement is a medicine for creating change.", author: "Carol Welch" },
  { text: "The doctor of the future will give no medicine.", author: "Thomas Edison" },
];

export function getDailyQuote() {
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  );
  return quotes[dayOfYear % quotes.length];
}
