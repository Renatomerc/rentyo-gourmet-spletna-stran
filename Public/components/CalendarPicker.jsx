import React, { useState, useRef, useEffect } from 'react';
import { format, isSameDay as checkSameDay } from 'date-fns';
import { ChevronLeft, ChevronRight } from 'lucide-react';

// Ikona puščica navzdol (za ChevronDown, če bi jo potrebovali drugje)
// const ChevronDown = ({ className }) => <svg className={className} xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>;

// Pomožna funkcija za preverjanje istosti datuma
const isSameDay = (d1, d2) => 
  d1 && d2 && checkSameDay(d1, d2);

// --- KOMPONENTA ZA POSAMEZNI DAN ---
const Day = ({ date, isSelected, isToday, isCurrentMonth, onSelect }) => {
  // Privzeti stili za vse celice
  let classes = "w-9 h-9 flex items-center justify-center rounded-lg text-sm font-medium transition duration-150 ease-in-out";

  // Stil za izbrani datum
  if (isSelected) {
    classes += " bg-gray-900 text-white shadow-md hover:bg-gray-800";
  // Stil za današnji datum, če ni izbran
  } else if (isToday) {
    classes += " text-indigo-600 border border-indigo-200 bg-indigo-50 hover:bg-indigo-100";
  // Stil za datume iz trenutnega meseca
  } else if (isCurrentMonth) {
    classes += " text-gray-700 hover:bg-gray-100";
  // Stil za datume iz prejšnjih/naslednjih mesecev (minimalno poudarjeno)
  } else {
    classes += " text-gray-400 pointer-events-none"; // onemogočimo klik
  }
  
  if (isCurrentMonth) {
      classes += " cursor-pointer";
  } else {
      classes += " opacity-60";
  }


  return (
    <div
      className={classes}
      onClick={isCurrentMonth ? () => onSelect(date) : undefined}
    >
      {date.getDate()}
    </div>
  );
};

// --- POMOŽNA FUNKCIJA ZA USTVARJANJE MESECA ---
const getMonthDays = (year, month) => {
  const date = new Date(year, month, 1);
  const firstDay = date.getDay(); 
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const days = [];

  // Pridobi dni pred začetkom meseca (za poravnavo - ponedeljek je 1, nedelja je 0)
  const paddingStart = (firstDay === 0) ? 6 : firstDay - 1; 
  
  // Dodamo dni v mesecu
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ 
      date: new Date(year, month, i), 
      isCurrentMonth: true 
    });
  }

  // Prejšnji mesec 
  const daysInPrevMonth = new Date(year, month, 0).getDate();
  for (let i = paddingStart; i > 0; i--) {
    days.unshift({ 
      date: new Date(year, month - 1, daysInPrevMonth - i + 1), 
      isCurrentMonth: false 
    });
  }

  // Naslednji mesec 
  const paddingEnd = 42 - days.length; 
  for (let i = 1; i <= paddingEnd; i++) {
    days.push({ 
      date: new Date(year, month + 1, i), 
      isCurrentMonth: false 
    });
  }
  
  return days;
};

// --- GLAVNA KOMPONENTA KOLEDARJA (IZVOZENA ZA UPORABO KOT POPUP OKNO) ---
export const CustomCalendar = ({ selectedDate, onSelectDate, onClose, buttonRef }) => {
  const today = new Date();
  // Uporaba stanja za mesec, ki ga koledar prikazuje
  const [currentMonth, setCurrentMonth] = useState(selectedDate || today);
  const calendarRef = useRef(null);
  
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  
  const days = getMonthDays(year, month);

  // Zapri koledar ob kliku izven njega ali ob kliku na gumb (če je ta vključen)
  useEffect(() => {
    const handleClickOutside = (event) => {
      // Preveri, ali klik ni na koledarju IN klik ni na gumbu, ki ga je odprl
      if (calendarRef.current && !calendarRef.current.contains(event.target) && 
          buttonRef.current && !buttonRef.current.contains(event.target)) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose, buttonRef]);

  const handleNextMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handlePrevMonth = () => {
    setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };
  
  const handleDayClick = (date) => {
    onSelectDate(date);
    onClose(); // *** Samodejno zapiranje po izbiri datuma ***
  };
  
  // Odslej brez imen dni v tednu

  return (
    // Pozicija mora biti absolutna glede na relativni starš (Vaš input field)
    <div 
        ref={calendarRef} 
        // Koledar postavimo na določeno pozicijo. Opozorilo: Če imate vnosno polje levo, 
        // boste morda morali "right-0" zamenjati z "left-0" ali "left-1/2"
        className="absolute z-10 top-full mt-2 right-0 bg-white p-6 rounded-2xl shadow-xl border border-gray-100 w-72 transform origin-top-right transition duration-300 ease-out"
    >
      
      {/* Glava koledarja: Ime meseca in navigacija */}
      <header className="flex items-center justify-between mb-4">
        {/* Minimalističen gumb za nazaj */}
        <button onClick={handlePrevMonth} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition duration-150 ease-in-out">
          <ChevronLeft className="w-5 h-5" />
        </button>
        
        {/* Ime meseca (centrirano in čisto) */}
        <h2 className="text-md font-semibold text-gray-800 tracking-wide">
          {/* Format meseca je zdaj lokaliziran z date-fns nastavitvami */}
          {format(currentMonth, 'MMMM yyyy', { locale: { month: [
              'Januar', 'Februar', 'Marec', 'April', 'Maj', 'Junij',
              'Julij', 'Avgust', 'September', 'Oktober', 'November', 'December'
          ]}})}
        </h2>
        
        {/* Minimalističen gumb za naprej */}
        <button onClick={handleNextMonth} className="p-1 rounded-full text-gray-500 hover:bg-gray-100 transition duration-150 ease-in-out">
          <ChevronRight className="w-5 h-5" />
        </button>
      </header>
      
      {/* ODSLEJ BREZ IMEN DNI V TEDNU - samo mreža dni */}
      <div className="grid grid-cols-7 gap-1">
        {days.map((day, index) => (
          <div key={index} className="flex justify-center">
            <Day
                date={day.date}
                isSelected={isSameDay(day.date, selectedDate)}
                isToday={isSameDay(day.date, today)}
                isCurrentMonth={day.isCurrentMonth}
                onSelect={handleDayClick}
              />
          </div>
        ))}
      </div>
    </div>
  );
};


// --- HOOK ZA UPRAVLJANJE STANJA (ZA ENOSTAVNO INTEGRACIJO V OBSTOJEČO KODO) ---
export const useCalendarState = (initialDate = new Date()) => {
    const [selectedDate, setSelectedDate] = useState(initialDate); 
    const [isOpen, setIsOpen] = useState(false);
    
    // Funkcija za posodobitev datuma
    const handleDateSelect = (date) => {
      setSelectedDate(date);
    };
    
    // Zapre in odpre koledar
    const toggleOpen = () => {
        setIsOpen(prev => !prev);
    };
    
    return {
        selectedDate,
        formattedDate: selectedDate ? format(selectedDate, 'EEEE, dd.MM.yyyy') : 'Izberi datum ...',
        isOpen,
        toggleOpen,
        handleDateSelect,
        setIsOpen
    };
}


// Odslej ne izvažamo celotne komponente CalendarPicker
// export default function CalendarPicker() { ... }