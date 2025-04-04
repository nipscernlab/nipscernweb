document.addEventListener('DOMContentLoaded', function() {
  // Fallacies data
  const fallacies = [
    {
      id: 'R1',
      name: 'The appeal to the populace',
      latin: 'ad populum',
      definition: 'When correct reasoning is replaced by devices calculated to elicit emotional and nonrational support for the conclusion urged.',
      examples: 'Example: "Everyone is buying this product, so it must be good!"'
    },
    {
      id: 'R2',
      name: 'The appeal to emotion',
      latin: '',
      definition: 'When correct reasoning is replaced by appeals to specific emotions, such as pity, pride, or envy.',
      examples: 'Example: "If you truly cared about children, you would support this policy."'
    },
    {
      id: 'R3',
      name: 'The red herring',
      latin: '',
      definition: 'When correct reasoning is manipulated by the introduction of some event or character that deliberately misleads the audience and thus hinders rational inference.',
      examples: 'Example: "Why focus on my client\'s tax fraud when there are much bigger tax evaders out there?"'
    },
    {
      id: 'R4',
      name: 'The straw man',
      latin: '',
      definition: 'When correct reasoning is undermined by the deliberate misrepresentation of the opponent\'s position.',
      examples: 'Example: "She wants environmental regulations, which means she wants to destroy all businesses."'
    },
    {
      id: 'R5',
      name: 'The attack on the person',
      latin: 'ad hominem',
      definition: 'When correct reasoning about some issue is replaced by an attack upon the character or special circumstances of the opponent.',
      examples: 'Example: "Don\'t listen to his argument about climate change; he drives an SUV."'
    },
    {
      id: 'R6',
      name: 'The appeal to force',
      latin: 'ad baculum',
      definition: 'When reasoning is replaced by threats in the effort to win support or assent.',
      examples: 'Example: "You\'d better agree with me if you want to keep your job."'
    },
    {
      id: 'R7',
      name: 'Missing the point',
      latin: 'ignoratio elenchi',
      definition: 'When correct reasoning is replaced by the mistaken refutation of a position that was not really at issue.',
      examples: 'Example: "You say we need better schools, but what about the crime rate?"'
    },
    {
      id: 'D1',
      name: 'Appeal to ignorance',
      latin: 'ad ignorantiam',
      definition: 'When it is argued that a proposition is true on the ground that it has not been proved false, or when it is argued that a proposition is false because it has not been proved true.',
      examples: 'Example: "No one has proven that ghosts don\'t exist, so they must be real."'
    },
    {
      id: 'D2',
      name: 'Appeal to inappropriate authority',
      latin: 'ad verecundiam',
      definition: 'When the premises of an argument appeal to the judgment of some person or persons who have no legitimate claim to authority in the matter at hand.',
      examples: 'Example: "This actor says this diet plan works, so it must be effective."'
    },
    {
      id: 'D3',
      name: 'False cause',
      latin: 'non causa pro causa',
      definition: 'When one treats as the cause of a thing that which is not really the cause of that thing, often relying (as in the subtype post hoc ergo propter hoc) merely on the close temporal succession of two events.',
      examples: 'Example: "I wore my lucky socks and we won the game, so my socks caused our victory."'
    },
    {
      id: 'D4',
      name: 'Hasty generalization',
      latin: 'converse accident',
      definition: 'When one moves carelessly or too quickly from one or a very few instances to a broad or universal claim.',
      examples: 'Example: "My neighbor is a doctor and drives a luxury car, so all doctors must be rich."'
    },
    {
      id: 'P1',
      name: 'Accident',
      latin: '',
      definition: 'When one mistakenly applies a generalization to an individual case that it does not properly govern.',
      examples: 'Example: "Cutting people with knives is wrong. Surgeons cut people with knives. Therefore, surgeons are doing something wrong."'
    },
    {
      id: 'P2',
      name: 'Complex question',
      latin: 'plurium interrogationum',
      definition: 'When one argues by asking a question in such a way as to presuppose the truth of some assumption buried in that question.',
      examples: 'Example: "Have you stopped cheating on exams?" (presupposes the person has cheated)'
    },
    {
      id: 'P3',
      name: 'Begging the question',
      latin: 'petitio principii',
      definition: 'When one assumes in the premises of an argument the truth of what one seeks to establish in the conclusion of that same argument.',
      examples: 'Example: "This book is true because it says so in the book itself."'
    },
    {
      id: 'A1',
      name: 'Equivocation',
      latin: '',
      definition: 'When the same word or phrase is used with two or more meanings, deliberately or accidentally, in formulating an argument.',
      examples: 'Example: "A feather is light. What is light cannot be dark. Therefore, a feather cannot be dark."'
    },
    {
      id: 'A2',
      name: 'Amphiboly',
      latin: '',
      definition: 'When one of the statements in an argument has more than one plausible meaning, because of the loose or awkward way in which the words in that statement have been combined.',
      examples: 'Example: "I shot an elephant in my pajamas. How the elephant got into my pajamas, I will never know."'
    },
    {
      id: 'A3',
      name: 'Accent',
      latin: '',
      definition: 'When a shift of meaning arises within an argument as a consequence of changes in the emphasis given to its words or parts.',
      examples: 'Example: "We should not speak ill of our friends" (emphasizing "friends" suggests it\'s okay to speak ill of others)'
    },
    {
      id: 'A4',
      name: 'Composition',
      latin: '',
      definition: 'This fallacy is committed (a) when one reasons mistakenly from the attributes of a part to the attributes of the whole, or (b) when one reasons mistakenly from the attributes of an individual member of some collection to the attributes of the totality of that collection.',
      examples: 'Example: "Each part of this machine is lightweight, so the whole machine must be lightweight."'
    },
    {
      id: 'A5',
      name: 'Division',
      latin: '',
      definition: 'This fallacy is committed (a) when one reasons mistakenly from the attributes of a whole to the attributes of one of its parts, or (b) when one reasons mistakenly from the attributes of a totality of some collection of entities to the attributes of the individual entities within that collection.',
      examples: 'Example: "This university is over 100 years old, so every building on campus must be over 100 years old."'
    }
  ];
  
  let gameState = {
    fallacies: [...fallacies],
    selectedFallacy: null,
    revealStage: 0,
    completedFallacies: [],
    ratings: {},
    maxRating: 3,
    totalPossibleStars: fallacies.length * 3
  };

  // DOM Elements
  const modal = document.getElementById('fallacyModal');
  const openBtn = document.getElementById('openFallacyGame');
  const closeBtn = document.querySelector('.close');
  const cardContainer = document.getElementById('cardContainer');
  const selectedCardContainer = document.getElementById('selectedCardContainer');
  const selectedCardContent = document.getElementById('selectedCardContent');
  const cardTitle = document.getElementById('cardTitle');
  const cardLatin = document.getElementById('cardLatin');
  const cardDefinition = document.getElementById('cardDefinition');
  const cardExamples = document.getElementById('cardExamples');
  const nextBtn = document.getElementById('nextBtn');
  const ratingContainer = document.getElementById('ratingContainer');
  const resultContainer = document.getElementById('resultContainer');
  const resultText = document.getElementById('resultText');
  const playAgainBtn = document.getElementById('playAgainBtn');
  const progressIndicator = document.querySelector('.progress-indicator');

  // Function to shuffle an array (Fisher-Yates algorithm)
  function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  // Open the modal
  openBtn.addEventListener('click', () => {
    modal.style.display = 'block';
    // Force browser reflow
    void modal.offsetWidth;
    modal.classList.add('show');
    initializeGame();
  });

  // Modify close button handler for smooth closing
  closeBtn.addEventListener('click', () => {
    modal.classList.remove('show');
    setTimeout(() => {
      modal.style.display = 'none';
    }, 300);
  });

  // Close modal when clicking outside the content
  window.addEventListener('click', (event) => {
    if (event.target === modal) {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
    }
  });

  // Initialize the game
  function initializeGame() {
    // Reset game state with shuffled fallacies
    gameState = {
      fallacies: shuffleArray([...fallacies]), // Shuffle the fallacies
      selectedFallacy: null,
      revealStage: 0,
      completedFallacies: [],
      ratings: {},
      maxRating: 3,
      totalPossibleStars: fallacies.length * 3
    };

    // Clear containers
    cardContainer.innerHTML = '';
    selectedCardContainer.style.display = 'none';
    resultContainer.style.display = 'none';
    progressIndicator.textContent = 'Select a fallacy card to begin';

    // Create fallacy cards
    gameState.fallacies.forEach(fallacy => {
      const card = document.createElement('div');
      card.className = 'card';
      card.dataset.id = fallacy.id;
      card.innerHTML = `
        <div class="card-inner">
          <div class="card-front">
            <i class="fas fa-brain"></i>
          </div>
          <div class="card-back">
            ${fallacy.name}
          </div>
        </div>
      `;
      
      card.addEventListener('click', () => selectFallacy(fallacy));
      cardContainer.appendChild(card);
    });
  }

  // Handle fallacy selection
  function selectFallacy(fallacy) {
    if (gameState.completedFallacies.includes(fallacy.id)) {
      return; // Skip if already completed
    }

    gameState.selectedFallacy = fallacy;
    gameState.revealStage = 0;
    
    // Hide all cards and show selected card info
    cardContainer.style.display = 'none';
    selectedCardContainer.style.display = 'flex';
    ratingContainer.style.display = 'none';
    ratingContainer.classList.remove('show'); // Reset rating animation
    
    // Reset content visibility
    cardTitle.textContent = fallacy.name;
    cardLatin.textContent = '';
    cardDefinition.textContent = '';
    cardExamples.textContent = '';
    
    // Update progress indicator
    const remaining = gameState.fallacies.length - gameState.completedFallacies.length;
    progressIndicator.textContent = `Fallacies remaining: ${remaining}`;
    
    nextBtn.textContent = 'Next';
    nextBtn.disabled = false;
  }

  // Handle next button click
  nextBtn.addEventListener('click', () => {
    gameState.revealStage++;
    
    switch (gameState.revealStage) {
      case 1:
        // Show Latin name if exists
        if (gameState.selectedFallacy.latin) {
          cardLatin.textContent = gameState.selectedFallacy.latin;
          cardLatin.classList.add('animation-flash');
        }
        break;
        
      case 2:
        // Show definition
        cardDefinition.textContent = gameState.selectedFallacy.definition;
        cardDefinition.classList.add('animation-flash');
        break;
        
      case 3:
        // Show examples
        cardExamples.textContent = gameState.selectedFallacy.examples;
        cardExamples.classList.add('animation-flash');
        nextBtn.textContent = 'Rate Your Knowledge';
        break;
        
      case 4:
        // Show rating interface
        ratingContainer.style.display = 'block';
        setTimeout(() => {
          ratingContainer.classList.add('show');
        }, 10);
        nextBtn.disabled = true; // Disable until rating is selected
        break;
        
      case 5:
        // Mark fallacy as completed
        gameState.completedFallacies.push(gameState.selectedFallacy.id);
        
        // Reset stars
        document.querySelectorAll('.star').forEach(s => {
          s.classList.remove('active');
        });
        
        // Hide rating container and remove show class
        ratingContainer.classList.remove('show');
        setTimeout(() => {
          ratingContainer.style.display = 'none';
        }, 300);
        
        // Return to card selection and update displayed cards
        selectedCardContainer.style.display = 'none';
        cardContainer.style.display = 'flex';
        updateCardDisplay();
        
        // Check if game is complete
        if (gameState.completedFallacies.length === gameState.fallacies.length) {
          showResults();
        } else {
          // Update progress indicator
          const remaining = gameState.fallacies.length - gameState.completedFallacies.length;
          progressIndicator.textContent = `Fallacies remaining: ${remaining}`;
        }
        break;
    }
  });

  // Update card display to hide completed cards
  function updateCardDisplay() {
    const cards = cardContainer.querySelectorAll('.card');
    cards.forEach(card => {
      const cardId = card.dataset.id;
      if (gameState.completedFallacies.includes(cardId)) {
        card.style.display = 'none';
      }
    });
  }

  // Handle star rating
  document.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const rating = parseInt(star.dataset.rating);
      gameState.ratings[gameState.selectedFallacy.id] = rating;
      
      // Update star display with animation
      document.querySelectorAll('.star').forEach((s, index) => {
        setTimeout(() => {
          if (parseInt(s.dataset.rating) <= rating) {
            s.classList.add('active');
          } else {
            s.classList.remove('active');
          }
        }, index * 100); // Staggered animation
      });
      
      // Enable next button after a slight delay
      setTimeout(() => {
        nextBtn.disabled = false;
        nextBtn.textContent = 'Continue';
      }, 400);
    });
  });

  // Show final results
  function showResults() {
    resultContainer.style.display = 'block';
    setTimeout(() => {
      resultContainer.classList.add('show');
    }, 10);
    
    selectedCardContainer.style.display = 'none';
    cardContainer.style.display = 'none';
    
    // Calculate total stars
    let totalStars = 0;
    Object.values(gameState.ratings).forEach(rating => {
      totalStars += rating;
    });
    
    // Display results
    const percentage = Math.round((totalStars / gameState.totalPossibleStars) * 100);
    resultText.innerHTML = `
      <h3>Game Complete!</h3>
      <p>Your score: ${totalStars} out of ${gameState.totalPossibleStars} stars (${percentage}%)</p>
      <div>
        ${getStarRating(totalStars, gameState.totalPossibleStars)}
      </div>
      <p>${getFeedback(percentage)}</p>
    `;
    
    progressIndicator.textContent = 'Game complete!';
  }

  // Get star rating display
  function getStarRating(stars, total) {
    const maxStars = 5;
    const normalizedStars = Math.round((stars / total) * maxStars);
    let result = '';
    
    for (let i = 1; i <= maxStars; i++) {
      if (i <= normalizedStars) {
        result += '<span class="star active"><i class="fas fa-star"></i></span>';
      } else {
        result += '<span class="star"><i class="fas fa-star"></i></span>';
      }
    }
    
    return result;
  }

  // Get feedback based on percentage
  function getFeedback(percentage) {
    if (percentage >= 90) {
      return 'Excellent! You\'re a master of logical fallacies!';
    } else if (percentage >= 70) {
      return 'Great job! You have a solid understanding of logical fallacies.';
    } else if (percentage >= 50) {
      return 'Good effort! Keep studying to improve your knowledge.';
    } else {
      return 'You\'re on your way to learning about logical fallacies. Keep practicing!';
    }
  }

  // Play again button
  playAgainBtn.addEventListener('click', () => {
    resultContainer.classList.remove('show');
    setTimeout(() => {
      resultContainer.style.display = 'none';
      initializeGame();
      // Garantir que o container de cartões esteja visível
      cardContainer.style.display = 'flex';
      // Garantir que nenhum outro container esteja visível
      selectedCardContainer.style.display = 'none';
      ratingContainer.style.display = 'none';
    }, 300);
  });
});